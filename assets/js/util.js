/* Shared, dependency-free helpers. */

import { mimeFor } from "./catalog.js";

let seq = 0;
export function uid(prefix = "f") {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}`;
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(1)} ${units[i]}`;
}

export function durationText(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
           : `${m}:${String(r).padStart(2, "0")}`;
}

export function dateText(ms) {
  if (!ms) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(ms));
  } catch { return ""; }
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export function safeName(name, fallback = "file") {
  const cleaned = String(name || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim();
  return cleaned || fallback;
}

export function stemOf(name) {
  const base = String(name || "").split("/").pop();
  const i = base.lastIndexOf(".");
  return i > 0 ? base.slice(0, i) : base;
}

export function splitExt(name) {
  const base = String(name || "").split("/").pop();
  const i = base.lastIndexOf(".");
  if (i <= 0) return [base, ""];
  return [base.slice(0, i), base.slice(i + 1).toLowerCase()];
}

export function uniqueName(name, taken = new Set()) {
  const [stem, ext] = splitExt(name);
  let candidate = ext ? `${stem}.${ext}` : stem;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = ext ? `${stem} ${n}.${ext}` : `${stem} ${n}`;
    n += 1;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

export function fileFromBlob(blob, name, type) {
  return new File([blob], name, { type: type || blob.type || mimeFor(splitExt(name)[1]), lastModified: Date.now() });
}

export async function blobBytes(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

export async function blobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(`This browser could not encode ${type}.`))), type, quality);
  });
}

export async function decodeImage(blob, { tiff = null } = {}) {
  if (tiff) return tiff(blob);
  try {
    return await createImageBitmap(blob);
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("The image could not be read."));
        img.src = url;
      });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }
}

export function drawToCanvas(source, width, height, background = null) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

export async function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName(name);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function writeToDirectory(dirHandle, blob, name) {
  const handle = await dirHandle.getFileHandle(safeName(name), { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function makeZip(entries, level = 6) {
  const { loadJSZip } = await import("./loaders.js");
  const JSZip = await loadJSZip();
  const zip = new JSZip();
  for (const e of entries) zip.file(e.name, e.blob);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level } });
}

/* Deliver one or more results.  One file downloads directly; several become a
 * zip so the browser cannot silently swallow all but the last. */
export async function deliver(results, { stem = "a2z", dirHandle = null } = {}) {
  const list = results.filter(Boolean);
  if (!list.length) throw new Error("The conversion produced no file.");
  const taken = new Set();
  for (const r of list) r.name = uniqueName(r.name, taken);
  if (list.length === 1) {
    const one = list[0];
    if (dirHandle) await writeToDirectory(dirHandle, one.blob, one.name);
    else await download(one.blob, one.name);
    return list;
  }
  const zipName = `${stem}.zip`;
  const zipBlob = await makeZip(list);
  if (dirHandle) await writeToDirectory(dirHandle, zipBlob, zipName);
  else await download(zipBlob, zipName);
  return list;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function nextFrame() {
  await new Promise((r) => requestAnimationFrame(() => r()));
}

export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

export function svgDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function xmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  }[c]));
}

export function parseTimecode(value) {
  const s = String(value).trim().replace(",", ".");
  const m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.](\d{1,3}))?$/);
  if (!m) return 0;
  const [, h = "0", mm = "0", ss = "0", ms = "0"] = m;
  return Number(h) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms.padEnd(3, "0")) / 1000;
}

export function formatTimecode(seconds, comma = true) {
  const t = Math.max(0, seconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ms = Math.round((t - Math.floor(t)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${comma ? "," : "."}${String(ms).padStart(3, "0")}`;
}

export function plainTextFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body?.innerText || doc.body?.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

export function downloadNameFor(card, target, ext) {
  return `${stemOf(card.name)}.${ext}`;
}
