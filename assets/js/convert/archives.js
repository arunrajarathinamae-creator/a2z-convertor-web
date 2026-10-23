/* Archives: ZIP through JSZip, TAR through a small POSIX writer/reader,
 * gzip through fflate.  RAR, 7z, bzip2 and xz are absent from what the
 * browser can read, and the catalogue says so rather than failing halfway. */

import { extension, stem } from "../catalog.js";
import { makeZip, safeName, splitExt } from "../util.js";
import { loadFflate, loadJSZip } from "../loaders.js";

function isArchive(name) {
  return ["zip", "tar", "gz", "tgz", "tar.gz"].includes(extension(name)) ||
    name.toLowerCase().endsWith(".tar.gz");
}

function tarName(name) {
  const clean = name.replace(/^\/+/, "").replace(/\\/g, "/");
  return clean.length > 100 ? clean.slice(-100) : clean;
}

/* A plain ustar writer: enough for ordinary files and folders. */
function writeTar(entries) {
  const chunks = [];
  for (const { name, data } of entries) {
    const header = new Uint8Array(512);
    const enc = new TextEncoder();
    const put = (offset, str, len) => {
      const bytes = enc.encode(str);
      header.set(bytes.subarray(0, len), offset);
    };
    put(0, tarName(name), 100);
    put(100, "0000644\0", 8);
    put(108, "0000000\0", 8);
    put(116, "0000000\0", 8);
    put(124, `${data.length.toString(8).padStart(11, "0")}\0`, 12);
    put(136, "00000000000\0", 12);
    header[156] = 48; // regular file
    put(257, "ustar\0", 6);
    put(263, "00", 2);
    let sum = 0;
    for (const b of header) sum += b;
    put(148, `${sum.toString(8).padStart(6, "0")}\0 `, 8);
    chunks.push(header, data);
    const pad = (512 - (data.length % 512)) % 512;
    if (pad) chunks.push(new Uint8Array(pad));
  }
  chunks.push(new Uint8Array(1024));
  return new Blob(chunks, { type: "application/x-tar" });
}

function readTar(buffer) {
  const bytes = new Uint8Array(buffer);
  const out = [];
  let off = 0;
  const dec = new TextDecoder();
  while (off + 512 <= bytes.length) {
    const header = bytes.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const name = dec.decode(header.subarray(0, 100)).replace(/\0.*$/, "");
    const prefix = dec.decode(header.subarray(345, 500)).replace(/\0.*$/, "");
    const full = prefix ? `${prefix}/${name}` : name;
    const size = parseInt(dec.decode(header.subarray(124, 136)).replace(/\0.*$/, "").trim() || "0", 8);
    const type = header[156];
    off += 512;
    if (type === 0 || type === 48) {
      if (full && !full.endsWith("/")) out.push({ name: full, data: bytes.slice(off, off + size) });
    }
    off += Math.ceil(size / 512) * 512;
  }
  return out;
}

export async function readArchive(card) {
  const ext = extension(card.name);
  const bytes = new Uint8Array(await card.blob.arrayBuffer());
  if (ext === "zip") {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(bytes);
    const out = [];
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir || name.startsWith("__MACOSX/") || name.endsWith(".DS_Store")) continue;
      out.push({ name, data: await entry.async("uint8array") });
    }
    return out;
  }
  const fflate = await loadFflate();
  if (ext === "tar") return readTar(bytes);
  if (ext === "gz" || ext === "tgz" || card.name.toLowerCase().endsWith(".tar.gz")) {
    const raw = fflate.gunzipSync(bytes);
    if (ext === "tgz" || card.name.toLowerCase().endsWith(".tar.gz") || (raw[257] === 0x75 && raw[258] === 0x73)) {
      return readTar(raw);
    }
    return [{ name: splitExt(card.name)[0].replace(/\.tar$/i, "") || `${stem(card.name)}`, data: raw }];
  }
  throw new Error("This archive type is not readable in the browser.");
}

export async function archiveInfo(card) {
  try {
    const entries = await readArchive(card);
    return { count: entries.length, meta: `${entries.length} item${entries.length === 1 ? "" : "s"}` };
  } catch {
    return { count: 0, meta: "" };
  }
}

async function entriesToBlob(entries, format, level = 6) {
  if (format === "zip") {
    return makeZip(entries.map((e) => ({ name: e.name, blob: new Blob([e.data]) })), level);
  }
  if (format === "tar") return writeTar(entries);
  if (format === "gzip" || format === "gz") {
    const fflate = await loadFflate();
    if (entries.length === 1) {
      return new Blob([fflate.gzipSync(entries[0].data, { level })], { type: "application/gzip" });
    }
    const tarBlob = writeTar(entries);
    return new Blob([fflate.gzipSync(new Uint8Array(await tarBlob.arrayBuffer()), { level })], { type: "application/gzip" });
  }
  throw new Error(`No archive writer for ${format}.`);
}

export async function convertArchive(card, target) {
  const entries = await readArchive(card);
  if (!entries.length) throw new Error("This archive is empty.");
  const base = stem(card.name);
  const blob = await entriesToBlob(entries, target.key);
  const ext = target.key === "gzip" ? "gz" : target.key;
  return [{ name: `${base}.${ext}`, blob }];
}

export async function runArchiveTool(card, tool, opts = {}, ctx = {}) {
  if (tool.key === "extract") {
    if (!isArchive(card.name)) throw new Error("This file is not an archive.");
    const entries = await readArchive(card);
    if (!entries.length) throw new Error("This archive is empty.");
    const used = new Set();
    const files = entries.map((e) => {
      let base = e.name.split("/").filter(Boolean).pop() || "file";
      let n = 1;
      while (used.has(base.toLowerCase())) {
        const [s, x] = splitExt(base);
        base = x ? `${s} ${++n}.${x}` : `${base} ${++n}`;
      }
      used.add(base.toLowerCase());
      return new File([e.data], safeName(base), { type: "application/octet-stream" });
    });
    ctx.ingest?.(files, `Extracted ${files.length} file${files.length === 1 ? "" : "s"}`);
    return [];
  }

  if (tool.key === "compress_archive") {
    const format = opts.format || "zip";
    const level = Math.max(1, Math.min(9, Number(opts.level) || 6));
    let entries;
    if (isArchive(card.name) && (ctx.selection?.length || 1) === 1) {
      entries = await readArchive(card);
    } else {
      const cards = ctx.selection?.length ? ctx.selection : [card];
      entries = [];
      for (const c of cards) {
        entries.push({ name: c.name, data: new Uint8Array(await c.blob.arrayBuffer()) });
      }
    }
    if (!entries.length) throw new Error("Nothing to compress.");
    const blob = await entriesToBlob(entries, format, level);
    const ext = format === "gzip" ? "gz" : format;
    let name = `${stem(card.name)}.${ext}`;
    if (format === "gzip" && entries.length > 1) name = `${stem(card.name)}.tar.gz`;
    return [{ name, blob }];
  }

  throw new Error(`Unknown archive tool: ${tool.key}`);
}

export { isArchive, writeTar, readTar };
