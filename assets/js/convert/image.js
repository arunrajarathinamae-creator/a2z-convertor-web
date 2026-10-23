/* Image conversions and tools: Canvas, TIFF, GIF, BMP, ICO and PDF.
 *
 * Nothing is uploaded.  The browser decodes the picture, a canvas does the
 * pixels, and a small encoder writes the file the person asked for.
 */

import { extension, mimeFor, probeAvif, stem } from "../catalog.js";
import { canvasToBlob, clamp, decodeImage, drawToCanvas } from "../util.js";
import { loadGifenc, loadPdfLib, loadUtif } from "../loaders.js";

function tiffDecoder(UTIF) {
  return async (blob) => {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const ifds = UTIF.decode(buf.buffer);
    if (!ifds?.length) throw new Error("This TIFF has no readable image.");
    UTIF.decodeImage(buf.buffer, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    const w = ifds[0].width;
    const h = ifds[0].height;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(w, h);
    img.data.set(rgba);
    ctx.putImageData(img, 0, 0);
    return canvas;
  };
}

export async function openImage(blob, name = "") {
  const ext = extension(name);
  if (["tif", "tiff"].includes(ext)) {
    const UTIF = await loadUtif();
    return tiffDecoder(UTIF)(blob);
  }
  return decodeImage(blob);
}

export function imageDimensions(source) {
  return {
    width: source.width || source.naturalWidth || 0,
    height: source.height || source.naturalHeight || 0,
  };
}

export async function imageInfo(blob, name) {
  try {
    const img = await openImage(blob, name);
    const { width, height } = imageDimensions(img);
    if (img.close && !(img instanceof HTMLCanvasElement)) img.close?.();
    return { dimensions: width && height ? `${width} × ${height}` : "", width, height };
  } catch {
    return { dimensions: "", width: 0, height: 0 };
  }
}

/* A small, cheap thumbnail for the file row. */
export async function imageThumb(blob, name) {
  const img = await openImage(blob, name);
  const { width, height } = imageDimensions(img);
  const scale = Math.min(1, 84 / Math.max(1, width), 64 / Math.max(1, height));
  const canvas = drawToCanvas(img, Math.max(1, width * scale), Math.max(1, height * scale), "#f1eeea");
  img.close?.();
  return canvas.toDataURL("image/png");
}

/* ------------------------------------------------------------------ codecs */
function encodeBmp(canvas) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  const data = ctx.getImageData(0, 0, w, h).data;
  const rowSize = Math.floor((24 * w + 31) / 32) * 4;
  const pixelSize = rowSize * h;
  const buf = new ArrayBuffer(54 + pixelSize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  // BITMAPFILEHEADER
  bytes[0] = 0x42; bytes[1] = 0x4d;
  view.setUint32(2, 54 + pixelSize, true);
  view.setUint32(10, 54, true);
  // BITMAPINFOHEADER
  view.setUint32(14, 40, true);
  view.setInt32(18, w, true);
  view.setInt32(22, h, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, pixelSize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  let p = 54;
  for (let y = h - 1; y >= 0; y -= 1) {
    const row = y * w * 4;
    for (let x = 0; x < w; x += 1) {
      const i = row + x * 4;
      bytes[p++] = data[i + 2];
      bytes[p++] = data[i + 1];
      bytes[p++] = data[i];
    }
    while ((p - 54) % rowSize) bytes[p++] = 0;
  }
  return new Blob([buf], { type: "image/bmp" });
}

async function encodeIco(canvas) {
  let src = canvas;
  if (canvas.width > 256 || canvas.height > 256) {
    const s = Math.min(256 / canvas.width, 256 / canvas.height);
    src = drawToCanvas(canvas, canvas.width * s, canvas.height * s, "#ffffff");
  }
  const png = await canvasToBlob(src, "image/png");
  const pngBytes = new Uint8Array(await png.arrayBuffer());
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);
  header[6] = src.width >= 256 ? 0 : src.width;
  header[7] = src.height >= 256 ? 0 : src.height;
  header[8] = 0; header[9] = 0;
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, pngBytes.length, true);
  view.setUint32(18, 22, true);
  return new Blob([header, pngBytes], { type: "image/x-icon" });
}

async function encodeTiff(canvas) {
  const UTIF = await loadUtif();
  const ctx = canvas.getContext("2d");
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const out = UTIF.encodeImage(rgba, canvas.width, canvas.height);
  return new Blob([out], { type: "image/tiff" });
}

async function encodeGif(canvas) {
  const gifenc = await loadGifenc();
  const { GIFEncoder, quantize, applyPalette } = gifenc;
  const ctx = canvas.getContext("2d");
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const palette = quantize(rgba, 256, { format: "rgb565" });
  const index = applyPalette(rgba, palette, "rgb565");
  const enc = GIFEncoder();
  enc.writeFrame(index, canvas.width, canvas.height, {
    palette, delay: 100, dispose: 0, transparent: false,
  });
  enc.finish();
  return new Blob([enc.bytes()], { type: "image/gif" });
}

export async function encodeCanvas(canvas, format, opts = {}) {
  const quality = clamp((Number(opts.quality) || 92) / 100, 0.2, 0.98);
  switch (format) {
    case "png": return canvasToBlob(canvas, "image/png");
    case "jpg":
    case "jpeg": {
      const flat = drawToCanvas(canvas, canvas.width, canvas.height, "#ffffff");
      return canvasToBlob(flat, "image/jpeg", quality);
    }
    case "webp": return canvasToBlob(canvas, "image/webp", quality);
    case "avif": {
      if (!probeAvif()) throw new Error("This browser has no AVIF encoder.");
      return canvasToBlob(canvas, "image/avif", quality);
    }
    case "bmp": return encodeBmp(canvas);
    case "ico": return encodeIco(canvas);
    case "tiff":
    case "tif": return encodeTiff(canvas);
    case "gif": return encodeGif(canvas);
    default:
      throw new Error(`No encoder for .${format}.`);
  }
}

export async function imageToPdf(canvas, dpi = 150) {
  const { PDFDocument } = await loadPdfLib();
  const pdf = await PDFDocument.create();
  const jpeg = await canvasToBlob(drawToCanvas(canvas, canvas.width, canvas.height, "#ffffff"), "image/jpeg", 0.92);
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  const img = await pdf.embedJpg(bytes);
  const scale = 72 / clamp(Number(dpi) || 150, 72, 300);
  const page = pdf.addPage([canvas.width * scale, canvas.height * scale]);
  page.drawImage(img, { x: 0, y: 0, width: canvas.width * scale, height: canvas.height * scale });
  const out = await pdf.save();
  return new Blob([out], { type: "application/pdf" });
}

/* ------------------------------------------------------------------ formats */
export async function convertImage(card, target, opts = {}, ctx = {}) {
  ctx.progress?.(0.1);
  const source = await openImage(card.blob, card.name);
  const { width, height } = imageDimensions(source);
  if (!width || !height) throw new Error("That image could not be decoded.");
  const canvas = drawToCanvas(source, width, height);
  source.close?.();
  ctx.progress?.(0.5);
  let blob;
  if (target.key === "pdf") {
    blob = await imageToPdf(canvas, opts.dpi);
  } else {
    blob = await encodeCanvas(canvas, target.key, opts);
  }
  ctx.progress?.(0.95);
  return [{ name: `${stem(card.name)}.${target.key === "jpeg" ? "jpg" : target.key}`, blob }];
}

/* ------------------------------------------------------------------- tools */
function nativeExt(card) {
  const ext = extension(card.name);
  const map = { jpeg: "jpg", tif: "tiff", jfif: "jpg" };
  const e = map[ext] || ext;
  return ["png", "jpg", "webp", "gif", "bmp", "tiff", "avif"].includes(e) ? e : "png";
}

export async function runImageTool(card, tool, opts = {}, ctx = {}) {
  const source = await openImage(card.blob, card.name);
  const { width, height } = imageDimensions(source);
  if (!width || !height) throw new Error("That image could not be decoded.");

  if (tool.key === "merge") {
    const cards = (ctx.selection?.length ? ctx.selection : [card]).filter((c) => c.category === "image");
    if (cards.length < 2) throw new Error("Select at least two images to merge.");
    const images = [];
    for (const c of cards) {
      const img = c.id === card.id ? source : await openImage(c.blob, c.name);
      images.push({ img, w: img.width || img.naturalWidth, h: img.height || img.naturalHeight });
    }
    const gap = Math.max(0, Number(opts.gap) || 0);
    const horizontal = opts.direction !== "vertical";
    const totalW = horizontal ? images.reduce((n, i) => n + i.w, 0) + gap * (images.length - 1) : Math.max(...images.map((i) => i.w));
    const totalH = horizontal ? Math.max(...images.map((i) => i.h)) : images.reduce((n, i) => n + i.h, 0) + gap * (images.length - 1);
    const out = document.createElement("canvas");
    out.width = totalW;
    out.height = totalH;
    const g = out.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, totalW, totalH);
    let x = 0, y = 0;
    for (const i of images) {
      const dx = horizontal ? x : Math.round((totalW - i.w) / 2);
      const dy = horizontal ? Math.round((totalH - i.h) / 2) : y;
      g.drawImage(i.img, dx, dy, i.w, i.h);
      if (horizontal) x += i.w + gap; else y += i.h + gap;
    }
    source.close?.();
    return [{ name: `${stem(card.name)} Merged.png`, blob: await encodeCanvas(out, "png") }];
  }

  const canvas = drawToCanvas(source, width, height);
  source.close?.();
  const ext = nativeExt(card);
  const suffix = {
    compress_image: "Compressed", crop_image: "Cropped", rotate_image: "Rotated",
    resize_image: "Resized", watermark: "Watermarked", remove_meta: "Clean",
  }[tool.key] || "Edited";

  if (tool.key === "compress_image") {
    let out = canvas;
    const maxW = Number(opts.max_width) || 0;
    if (maxW > 0 && width > maxW) out = drawToCanvas(canvas, maxW, Math.round(height * (maxW / width)), "#ffffff");
    const format = ["jpg", "webp", "avif"].includes(ext) ? ext : "png";
    return [{ name: `${stem(card.name)} Compressed.${format}`, blob: await encodeCanvas(out, format, opts) }];
  }

  if (tool.key === "crop_image") {
    const l = clamp(Number(opts.left) || 0, 0, 45) / 100;
    const r = clamp(Number(opts.right) || 0, 0, 45) / 100;
    const t = clamp(Number(opts.top) || 0, 0, 45) / 100;
    const b = clamp(Number(opts.bottom) || 0, 0, 45) / 100;
    const x = Math.round(width * l);
    const y = Math.round(height * t);
    const w = Math.max(1, Math.round(width * (1 - l - r)));
    const h = Math.max(1, Math.round(height * (1 - t - b)));
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    out.getContext("2d").drawImage(canvas, x, y, w, h, 0, 0, w, h);
    return [{ name: `${stem(card.name)} Cropped.${ext}`, blob: await encodeCanvas(out, ext, opts) }];
  }

  if (tool.key === "rotate_image") {
    const angle = Number(opts.angle) || 90;
    const swap = angle === 90 || angle === 270;
    const out = document.createElement("canvas");
    out.width = swap ? height : width;
    out.height = swap ? width : height;
    const g = out.getContext("2d");
    g.translate(out.width / 2, out.height / 2);
    g.rotate((angle * Math.PI) / 180);
    if (opts.flip) g.scale(-1, 1);
    g.drawImage(canvas, -width / 2, -height / 2);
    return [{ name: `${stem(card.name)} Rotated.${ext}`, blob: await encodeCanvas(out, ext, opts) }];
  }

  if (tool.key === "resize_image") {
    let w = Number(opts.width) || 0;
    let h = Number(opts.height) || 0;
    if (!w && !h) { w = width; h = height; }
    else if (!h || opts.keep !== false && (w && !h)) h = Math.round(height * (w / width));
    else if (!w) w = Math.round(width * (h / height));
    const out = drawToCanvas(canvas, w, h, "#ffffff");
    return [{ name: `${stem(card.name)} Resized.${ext}`, blob: await encodeCanvas(out, ext, opts) }];
  }

  if (tool.key === "watermark") {
    const out = drawToCanvas(canvas, width, height);
    const g = out.getContext("2d");
    const text = String(opts.text || "A2Z").slice(0, 40);
    const size = Math.max(8, (Math.min(width, height) * clamp(Number(opts.size) || 7, 2, 30)) / 100);
    g.font = `700 ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    g.fillStyle = `rgba(255,255,255,${clamp(Number(opts.opacity) || 60, 5, 100) / 100})`;
    g.shadowColor = "rgba(0,0,0,.35)";
    g.shadowBlur = Math.max(1, size / 12);
    const pad = Math.round(size * 0.6);
    const pos = opts.position || "bottom-right";
    const tw = g.measureText(text).width;
    if (pos === "tile") {
      g.shadowBlur = 0;
      g.save();
      g.translate(width / 2, height / 2);
      g.rotate(-Math.PI / 6);
      for (let y = -height; y < height; y += size * 4) {
        for (let x = -width; x < width; x += tw + size * 4) g.fillText(text, x, y);
      }
      g.restore();
    } else {
      let x = pad, y = height - pad;
      if (pos === "center") { x = (width - tw) / 2; y = height / 2 + size / 3; }
      if (pos === "bottom-right") { x = width - tw - pad; }
      if (pos === "top-right") { x = width - tw - pad; y = pad + size; }
      if (pos === "bottom-left") { y = height - pad; }
      g.fillText(text, x, y);
    }
    return [{ name: `${stem(card.name)} Watermarked.${ext}`, blob: await encodeCanvas(out, ext, opts) }];
  }

  if (tool.key === "remove_meta") {
    const format = ["jpg", "png", "webp"].includes(ext) ? ext : "png";
    return [{ name: `${stem(card.name)} Clean.${format}`, blob: await encodeCanvas(canvas, format, opts) }];
  }

  throw new Error(`Unknown image tool: ${tool.key}`);
}

export function imageOutputExt(card) {
  return nativeExt(card);
}

export function mimeForImage(ext) {
  return mimeFor(ext);
}
