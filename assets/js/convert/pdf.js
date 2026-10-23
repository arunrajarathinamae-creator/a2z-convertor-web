/* PDF work: read with pdf.js, write with pdf-lib.
 *
 * Pages can become TXT, Markdown, images, a slide deck or an EPUB; the tools
 * split, merge, rotate, re-save and strip metadata.  Every page image is
 * rendered locally and never leaves the tab.
 */

import { stem } from "../catalog.js";
import {
  blobBytes, canvasToBlob, clamp, escapeHtml, parseTimecode, xmlEscape,
} from "../util.js";
import { loadJSZip, loadPdfJs, loadPdfLib, loadPptxGen } from "../loaders.js";

const pdfCache = new WeakMap();

async function open(blob) {
  let p = pdfCache.get(blob);
  if (!p) {
    const pdfjs = await loadPdfJs();
    const data = new Uint8Array(await blob.arrayBuffer());
    p = pdfjs.getDocument({ data, isEvalSupported: false }).promise;
    pdfCache.set(blob, p);
  }
  return p;
}

export async function pdfInfo(blob) {
  try {
    const pdf = await open(blob);
    const meta = await pdf.getMetadata().catch(() => ({}));
    const page = await pdf.getPage(1);
    const box = page.getViewport({ scale: 1 });
    return {
      pages: pdf.numPages,
      dimensions: `${Math.round(box.width)} × ${Math.round(box.height)} pt`,
      title: meta?.info?.Title || "",
    };
  } catch {
    return { pages: 0, dimensions: "", title: "" };
  }
}

async function renderPage(pdf, number, dpi = 120) {
  const page = await pdf.getPage(number);
  const scale = clamp(Number(dpi) || 120, 36, 300) / 72;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { canvas, page, viewport };
}

async function extractText(pdf) {
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      text += item.str || "";
      if (item.hasEOL) text += "\n";
      else if (item.str) text += " ";
    }
    pages.push(text.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim());
  }
  return pages;
}

export async function pdfThumb(blob) {
  const pdf = await open(blob);
  const { canvas } = await renderPage(pdf, 1, 40);
  const scale = Math.min(1, 96 / canvas.width, 72 / canvas.height);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(canvas.width * scale));
  out.height = Math.max(1, Math.round(canvas.height * scale));
  out.getContext("2d").drawImage(canvas, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

async function imagePages(pdf, format, dpi, ctx) {
  const out = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const { canvas } = await renderPage(pdf, i, dpi);
    const blob = await canvasToBlob(canvas, format === "jpg" ? "image/jpeg" : "image/png", 0.92);
    out.push({ name: `${stem(ctx.name)} ${i}.${format}`, blob });
    ctx.progress?.(i / pdf.numPages);
  }
  return out;
}

function buildImageEpub(title, pages) {
  return (async () => {
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    const id = `a2z-${Date.now().toString(36)}`;
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file("META-INF/container.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);
    const manifest = [];
    const spine = [];
    for (let i = 0; i < pages.length; i += 1) {
      const name = `page-${i + 1}.jpg`;
      zip.file(`OEBPS/${name}`, pages[i].blob);
      manifest.push(`<item id="p${i + 1}" href="${name}" media-type="image/jpeg"/>`);
      spine.push(`<itemref idref="p${i + 1}"/>`);
    }
    zip.file("OEBPS/style.css", "html,body{margin:0;padding:0;background:#fff}img{display:block;width:100%;height:auto}body{text-align:center}");
    zip.file("OEBPS/nav.xhtml",
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${xmlEscape(title)}</title></head><body><nav epub:type="toc"><ol><li><a href="page-1.xhtml">Start</a></li></ol></nav></body></html>`);
    for (let i = 0; i < pages.length; i += 1) {
      zip.file(`OEBPS/page-${i + 1}.xhtml`,
        `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Page ${i + 1}</title><link rel="stylesheet" href="style.css"/></head><body><img src="page-${i + 1}.jpg" alt="Page ${i + 1}"/></body></html>`);
    }
    zip.file("OEBPS/package.opf",
      `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">${id}</dc:identifier><dc:title>${xmlEscape(title)}</dc:title><dc:language>en</dc:language></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>${manifest.join("")}${pages.map((_, i) => `<item id="x${i + 1}" href="page-${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join("")}</manifest>
<spine>${pages.map((_, i) => `<itemref idref="x${i + 1}"/>`).join("")}</spine></package>`);
    return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  })();
}

export async function convertPdf(card, target, opts = {}, ctx = {}) {
  const pdf = await open(card.blob);
  ctx.progress?.(0.1);
  if (target.key === "txt" || target.key === "md") {
    const pages = await extractText(pdf);
    ctx.progress?.(0.9);
    if (!pages.some((page) => page.trim())) {
      throw new Error("This PDF has no text layer. Convert its pages to PNG or JPG instead.");
    }
    if (target.key === "md") {
      const body = pages.map((t, i) => `## Page ${i + 1}\n\n${t}`).join("\n\n---\n\n");
      return [{ name: `${stem(card.name)}.md`, blob: new Blob([`# ${card.name}\n\n${body}\n`], { type: "text/markdown" }) }];
    }
    return [{ name: `${stem(card.name)}.txt`, blob: new Blob([pages.join("\n\n--- Page break ---\n\n")], { type: "text/plain" }) }];
  }
  if (target.key === "jpg" || target.key === "png") {
    return imagePages(pdf, target.key, 150, ctx);
  }
  if (target.key === "pptx") {
    const pages = await imagePages(pdf, "jpg", 130, ctx);
    const PptxGenJS = await loadPptxGen();
    const pptx = new PptxGenJS();
    const first = await renderPage(pdf, 1, 72);
    const ratio = first.viewport.height / first.viewport.width;
    const width = 10;
    const height = Math.max(3, Math.min(10, width * ratio));
    pptx.defineLayout({ name: "A2Z", width, height });
    pptx.layout = "A2Z";
    for (const p of pages) {
      const slide = pptx.addSlide();
      slide.addImage({ data: await blobDataUrlLocal(p.blob), x: 0, y: 0, w: width, h: height });
    }
    const out = await pptx.write({ outputType: "blob" });
    return [{ name: `${stem(card.name)}.pptx`, blob: out }];
  }
  if (target.key === "epub") {
    const pages = await imagePages(pdf, "jpg", 130, ctx);
    const blob = await buildImageEpub(card.name, pages);
    return [{ name: `${stem(card.name)}.epub`, blob }];
  }
  throw new Error(`No PDF conversion for ${target.key}.`);
}

async function blobDataUrlLocal(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function parseRanges(text, pages) {
  const clean = String(text || "").trim();
  if (!clean) {
    return Array.from({ length: pages }, (_, i) => ({ indices: [i], label: String(i + 1) }));
  }
  const ranges = [];
  for (const part of clean.split(",")) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw new Error(`"${part.trim()}" is not a page or range.`);
    const a = Math.max(1, Math.min(pages, Number(m[1])));
    const b = Math.max(1, Math.min(pages, Number(m[2] || m[1])));
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const indices = [];
    for (let i = lo; i <= hi; i += 1) indices.push(i - 1);
    ranges.push({ indices, label: lo === hi ? String(lo) : `${lo}-${hi}` });
  }
  return ranges;
}

export async function runPdfTool(card, tool, opts = {}, ctx = {}) {
  const { PDFDocument } = await loadPdfLib();
  if (tool.key === "merge") {
    const cards = (ctx.selection?.length ? ctx.selection : [card]).filter((c) => c.category === "pdf");
    if (cards.length < 2) throw new Error("Select at least two PDFs to merge.");
    const out = await PDFDocument.create();
    for (const c of cards) {
      const src = await PDFDocument.load(await blobBytes(c.blob), { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    }
    stripMeta(out);
    return [{ name: `${stem(card.name)} Merged.pdf`, blob: new Blob([await out.save()], { type: "application/pdf" }) }];
  }

  const src = await PDFDocument.load(await blobBytes(card.blob), { ignoreEncryption: true });

  if (tool.key === "split") {
    const ranges = parseRanges(opts.ranges, src.getPageCount());
    const out = [];
    for (let i = 0; i < ranges.length; i += 1) {
      const doc = await PDFDocument.create();
      const pages = await doc.copyPages(src, ranges[i].indices);
      pages.forEach((p) => doc.addPage(p));
      out.push({ name: `${stem(card.name)} ${ranges[i].label}.pdf`, blob: new Blob([await doc.save()], { type: "application/pdf" }) });
      ctx.progress?.((i + 1) / ranges.length);
    }
    return out;
  }

  if (tool.key === "rotate_pdf" || tool.key === "remove_meta" || tool.key === "compress_pdf") {
    if (tool.key === "rotate_pdf") {
      const angle = Number(opts.angle) || 90;
      for (const page of src.getPages()) page.setRotation({ type: "degrees", angle: ((page.getRotation().angle + angle) % 360) });
    }
    if (tool.key === "remove_meta" || tool.key === "compress_pdf") stripMeta(src);
    const bytes = await src.save({ useObjectStreams: true, addDefaultPage: false });
    const suffix = { rotate_pdf: "Rotated", remove_meta: "Clean", compress_pdf: "Compressed" }[tool.key];
    return [{ name: `${stem(card.name)} ${suffix}.pdf`, blob: new Blob([bytes], { type: "application/pdf" }) }];
  }

  throw new Error(`Unknown PDF tool: ${tool.key}`);
}

function stripMeta(doc) {
  doc.setTitle("");
  doc.setAuthor("");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setProducer("A2Z Convertor Web");
  doc.setCreator("A2Z Convertor Web");
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
}

export { parseRanges };
