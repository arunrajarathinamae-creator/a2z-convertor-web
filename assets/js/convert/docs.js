/* Documents, slides and spreadsheets.
 *
 * DOCX and ODT are read in the browser; PDF output is laid out with jsPDF.
 * PPTX/ODP slides are reduced to their text and rebuilt as real slide files.
 * SheetJS handles the spreadsheet family.  Formats that genuinely need a
 * desktop office suite are absent from the catalogue, exactly as on the
 * desktop build.
 */

import { extension, stem } from "../catalog.js";
import {
  blobDataUrl, canvasToBlob, escapeHtml, formatBytes, plainTextFromHtml, xmlEscape,
} from "../util.js";
import {
  loadJSZip, loadJsPdf, loadMammoth, loadMarked, loadPptxGen, loadTurndown, loadXlsx,
} from "../loaders.js";

/* --------------------------------------------------------------- reading */
async function readZipText(blob, file) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const entry = zip.file(file);
  return entry ? entry.async("text") : "";
}

function xmlDoc(text) {
  return new DOMParser().parseFromString(text, "application/xml");
}

function elementsNS(doc, ns, local) {
  return Array.from(doc.getElementsByTagNameNS(ns, local));
}

function htmlFromParagraphs(paras) {
  return paras.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n");
}

export async function readDocx(blob) {
  const mammoth = await loadMammoth();
  const arrayBuffer = await blob.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const raw = await mammoth.extractRawText({ arrayBuffer });
  return { html: result.value || "", text: (raw.value || "").trim() };
}

export async function readOdt(blob) {
  const xml = await readZipText(blob, "content.xml");
  const doc = xmlDoc(xml);
  const body = doc.getElementsByTagName("office:text")[0] || doc;
  const paras = [];
  for (const el of Array.from(body.getElementsByTagNameNS("*", "p"))) {
    const text = el.textContent.replace(/\s+/g, " ").trim();
    if (text) paras.push(text);
  }
  const heads = Array.from(body.getElementsByTagNameNS("*", "h"))
    .map((el) => el.textContent.trim()).filter(Boolean);
  return { html: htmlFromParagraphs(paras), text: [heads.join("\n"), paras.join("\n\n")].filter(Boolean).join("\n\n") };
}

export function readRtf(text) {
  let out = text
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(((Number(n) % 65536) + 65536) % 65536))
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\tab/g, "\t")
    .replace(/\{\\\*[^{}]*\}/g, "")
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\r/g, "");
  out = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { html: htmlFromParagraphs(out.split(/\n+/).filter(Boolean)), text: out };
}

export async function readEpub(blob) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const container = await zip.file("META-INF/container.xml")?.async("text");
  let root = "";
  if (container) {
    const m = container.match(/full-path="([^"]+)"/);
    root = m ? m[1] : "";
  }
  if (!root) {
    const first = Object.keys(zip.files).find((n) => n.endsWith(".opf"));
    root = first || "";
  }
  let html = "";
  let text = "";
  if (root) {
    const opf = xmlDoc(await zip.file(root).async("text"));
    const base = root.includes("/") ? root.slice(0, root.lastIndexOf("/") + 1) : "";
    const spine = elementsNS(opf, "*", "itemref").map((e) => e.getAttribute("idref")).filter(Boolean);
    const manifest = new Map(elementsNS(opf, "*", "item").map((e) => [e.getAttribute("id"), e.getAttribute("href")]));
    for (const id of spine) {
      const href = manifest.get(id);
      if (!href) continue;
      const file = zip.file(base + href);
      if (!file) continue;
      const source = await file.async("text");
      html += source;
      text += `${plainTextFromHtml(source)}\n\n`;
    }
  }
  if (!html) {
    const files = Object.keys(zip.files).filter((n) => /\.x?html?$/i.test(n));
    for (const name of files) {
      const source = await zip.file(name).async("text");
      html += source;
      text += `${plainTextFromHtml(source)}\n\n`;
    }
  }
  return { html, text: text.trim() };
}

export async function readDocument(card) {
  const ext = extension(card.name);
  if (ext === "docx") return readDocx(card.blob);
  if (ext === "odt") return readOdt(card.blob);
  if (ext === "rtf") return readRtf(await card.blob.text());
  if (ext === "epub") return readEpub(card.blob);
  if (ext === "html" || ext === "htm") {
    const text = await card.blob.text();
    return { html: text, text: plainTextFromHtml(text) };
  }
  if (ext === "md" || ext === "markdown") {
    const text = await card.blob.text();
    const marked = await loadMarked();
    return { html: marked.parse(text), text };
  }
  const text = await card.blob.text();
  return { html: `<pre>${escapeHtml(text)}</pre>`, text };
}

/* --------------------------------------------------------------- writing */
function blocksFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = [];
  const walk = (el) => {
    for (const node of Array.from(el.children)) {
      const tag = node.tagName.toLowerCase();
      if (["script", "style", "head"].includes(tag)) continue;
      if (/^h[1-6]$/.test(tag)) {
        const text = node.textContent.replace(/\s+/g, " ").trim();
        if (text) blocks.push({ text, size: tag === "h1" ? 20 : tag === "h2" ? 16 : 13, bold: true, gap: 10 });
      } else if (tag === "p" || tag === "li" || tag === "pre" || tag === "blockquote") {
        const text = node.textContent.replace(/[ \t]+/g, " ").trim();
        if (text) blocks.push({ text: tag === "li" ? `• ${text}` : text, size: 11, bold: false, gap: 6 });
      } else if (tag === "br") {
        blocks.push({ text: "", size: 11, bold: false, gap: 4 });
      } else {
        walk(node);
      }
    }
  };
  walk(doc.body);
  if (!blocks.length) {
    const text = plainTextFromHtml(html);
    if (text) blocks.push({ text, size: 11, bold: false, gap: 6 });
  }
  return blocks;
}

async function blocksToPdf(title, blocks) {
  const JsPDF = await loadJsPdf();
  const pdf = new JsPDF({ unit: "pt", format: "a4" });
  const margin = 54;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const height = pdf.internal.pageSize.getHeight();
  let y = margin;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(title, margin, y);
  y += 28;
  for (const b of blocks) {
    pdf.setFont("helvetica", b.bold ? "bold" : "normal");
    pdf.setFontSize(b.size);
    const lines = pdf.splitTextToSize(b.text || " ", width);
    const lineHeight = b.size * 1.45;
    for (const line of lines) {
      if (y + lineHeight > height - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += lineHeight;
    }
    y += b.gap || 4;
  }
  return pdf.output("blob");
}

function buildDocx(blocks, title) {
  return (async () => {
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    const paras = blocks.map((b) => {
      const text = xmlEscape(b.text || "");
      return `<w:p><w:pPr><w:spacing w:after="${b.gap ? 120 : 60}"/></w:pPr><w:r><w:rPr>${b.bold ? "<w:b/>" : ""}<w:sz w:val="${Math.round((b.size || 11) * 2)}"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
    }).join("");
    zip.file("[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
    zip.file("_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
    zip.file("word/_rels/document.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    zip.file("word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`);
    zip.file("word/styles.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:style></w:styles>`);
    zip.file("docProps/core.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xmlEscape(title)}</dc:title><dc:creator>A2Z Convertor Web</dc:creator></cp:coreProperties>`);
    return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  })();
}

function buildOdt(blocks, title) {
  return (async () => {
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    zip.file("mimetype", "application/vnd.oasis.opendocument.text", { compression: "STORE" });
    zip.file("META-INF/manifest.xml",
      `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/></manifest:manifest>`);
    const body = blocks.map((b) => {
      const tag = b.bold && b.size >= 16 ? "text:h" : "text:p";
      const level = b.size >= 20 ? 1 : b.size >= 16 ? 2 : 3;
      const attrs = tag === "text:h" ? ` text:outline-level="${level}"` : "";
      return `<${tag}${attrs} text:style-name="P${Math.round((b.size || 11) * 2)}">${xmlEscape(b.text || "")}</${tag}>`;
    }).join("");
    zip.file("content.xml",
      `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:text>${body}</office:text></office:body></office:document-content>`);
    zip.file("styles.xml",
      `<?xml version="1.0" encoding="UTF-8"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:version="1.2"><office:styles><style:style xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" style:name="Standard" style:family="paragraph"/></office:styles></office:document-styles>`);
    zip.file("meta.xml",
      `<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.2"><office:meta><dc:title>${xmlEscape(title)}</dc:title><meta:generator>A2Z Convertor Web</meta:generator></office:meta></office:document-meta>`);
    return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  })();
}

function buildTextEpub(title, text) {
  return (async () => {
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    const id = `a2z-${Date.now().toString(36)}`;
    const chapters = text.split(/\n{2,}/).filter((p) => p.trim());
    const body = chapters.map((p) => `<p>${escapeHtml(p.trim())}</p>`).join("");
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file("META-INF/container.xml",
      `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
    zip.file("OEBPS/content.xhtml",
      `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${xmlEscape(title)}</title><style>body{font-family:serif;line-height:1.55;margin:6%}h1{font-size:1.6em}</style></head><body><h1>${xmlEscape(title)}</h1>${body}</body></html>`);
    zip.file("OEBPS/package.opf",
      `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">${id}</dc:identifier><dc:title>${xmlEscape(title)}</dc:title><dc:language>en</dc:language></metadata><manifest><item id="c" href="content.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/></spine></package>`);
    return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  })();
}

function toRtf(text) {
  const escaped = text
    .replace(/\\/g, "\\\\").replace(/[{}]/g, "\\$&")
    .replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0)}?`)
    .replace(/\n/g, "\\par\n");
  return new Blob([`{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Helvetica;}}\\f0\\fs22 ${escaped}}`], { type: "application/rtf" });
}

export async function convertDocument(card, target, opts = {}, ctx = {}) {
  const { html, text } = await readDocument(card);
  ctx.progress?.(0.4);
  const blocks = blocksFromHtml(html);
  const finalText = (text || blocks.map((b) => b.text).join("\n\n")).trim();
  const base = stem(card.name);
  switch (target.key) {
    case "txt": return [{ name: `${base}.txt`, blob: new Blob([finalText], { type: "text/plain" }) }];
    case "md": {
      let md = finalText;
      if (html && !/^\s*</.test(text || "")) {
        const TurndownService = await loadTurndown();
        const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
        md = td.turndown(html);
      }
      if (!md.trim()) md = finalText;
      return [{ name: `${base}.md`, blob: new Blob([md], { type: "text/markdown" }) }];
    }
    case "html": {
      let out = html;
      if (!/<(p|h[1-6]|div|br|li|pre)\b/i.test(out)) {
        out = finalText.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("\n");
      }
      return [{ name: `${base}.html`, blob: new Blob([`<!doctype html><meta charset="utf-8"><title>${escapeHtml(base)}</title>${out}`], { type: "text/html" }) }];
    }
    case "pdf": {
      const blob = await blocksToPdf(base, blocks.length ? blocks : [{ text: finalText, size: 11, gap: 6 }]);
      return [{ name: `${base}.pdf`, blob }];
    }
    case "docx": {
      const blob = await buildDocx(blocks.length ? blocks : [{ text: finalText, size: 11, gap: 6 }], base);
      return [{ name: `${base}.docx`, blob }];
    }
    case "odt": {
      const blob = await buildOdt(blocks.length ? blocks : [{ text: finalText, size: 11, gap: 6 }], base);
      return [{ name: `${base}.odt`, blob }];
    }
    case "epub": {
      const blob = await buildTextEpub(base, finalText);
      return [{ name: `${base}.epub`, blob }];
    }
    case "rtf":
      return [{ name: `${base}.rtf`, blob: toRtf(finalText) }];
    default:
      throw new Error(`No document conversion for ${target.key}.`);
  }
}

export async function runDocumentTool(card, tool) {
  if (tool.key !== "remove_meta") throw new Error(`Unknown document tool: ${tool.key}`);
  const ext = extension(card.name);
  const base = stem(card.name);
  if (ext === "docx") {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(await card.blob.arrayBuffer());
    zip.remove("docProps/core.xml");
    zip.remove("docProps/app.xml");
    return [{ name: `${base} Clean.docx`, blob: await zip.generateAsync({ type: "blob", compression: "DEFLATE" }) }];
  }
  if (ext === "odt") {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(await card.blob.arrayBuffer());
    if (zip.file("meta.xml")) {
      zip.file("meta.xml", `<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.2"><office:meta><meta:generator>A2Z Convertor Web</meta:generator></office:meta></office:document-meta>`);
    }
    return [{ name: `${base} Clean.odt`, blob: await zip.generateAsync({ type: "blob", compression: "DEFLATE" }) }];
  }
  const clean = new Blob([await card.blob.arrayBuffer()], { type: card.blob.type });
  return [{ name: `${base} Clean.${ext}`, blob: clean }];
}

/* ------------------------------------------------------------------ slides */
export async function readSlides(card) {
  const ext = extension(card.name);
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(await card.blob.arrayBuffer());
  const pages = [];

  if (ext === "pptx") {
    const presentation = zip.file("ppt/presentation.xml");
    let size = { cx: 9144000, cy: 5143500 };
    if (presentation) {
      const xml = await presentation.async("text");
      const m = xml.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
      if (m) size = { cx: Number(m[1]), cy: Number(m[2]) };
    }
    const names = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]));
    for (const name of names) {
      const xml = await zip.file(name).async("text");
      const doc = xmlDoc(xml);
      const paras = elementsNS(doc, "*", "p").map((p) => Array.from(p.getElementsByTagNameNS("*", "t")).map((t) => t.textContent).join("").trim()).filter(Boolean);
      pages.push({ paras, size });
    }
  } else if (ext === "odp") {
    const content = await readZipText(card.blob, "content.xml");
    const doc = xmlDoc(content);
    const pageNodes = Array.from(doc.getElementsByTagNameNS("*", "page"));
    for (const node of pageNodes) {
      const paras = Array.from(node.getElementsByTagNameNS("*", "p")).map((p) => p.textContent.replace(/\s+/g, " ").trim()).filter(Boolean);
      pages.push({ paras, size: { cx: 9144000, cy: 5143500 } });
    }
  }
  return pages.filter((p) => p.paras.length);
}

function drawSlide(page, W = 1280, H = 720) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#282b29";
  const title = page.paras[0] || "";
  const body = page.paras.slice(1);
  ctx.font = `800 ${Math.round(H * 0.075)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  const max = W * 0.86;
  const words = title.split(/\s+/);
  let line = "";
  let y = H * 0.18;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > max && line) {
      ctx.fillText(line, W * 0.07, y);
      y += H * 0.1;
      line = word;
    } else line = test;
  }
  if (line) { ctx.fillText(line, W * 0.07, y); y += H * 0.09; }
  ctx.font = `400 ${Math.round(H * 0.04)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = "#4b5049";
  y = Math.max(y, H * 0.33);
  for (const p of body) {
    const lines = p.match(/.{1,80}(\s|$)/g) || [p];
    for (const l of lines) {
      if (y > H * 0.9) break;
      ctx.fillText(`•  ${l.trim()}`, W * 0.08, y);
      y += H * 0.062;
    }
  }
  ctx.fillStyle = "#f35b28";
  ctx.fillRect(0, H - 8, W, 8);
  return canvas;
}

export async function convertSlides(card, target, opts = {}, ctx = {}) {
  const pages = await readSlides(card);
  if (!pages.length) throw new Error("No slides with text were found in this deck.");
  const base = stem(card.name);
  if (["jpg", "png"].includes(target.key)) {
    const out = [];
    for (let i = 0; i < pages.length; i += 1) {
      const blob = await canvasToBlob(drawSlide(pages[i], 1600, 900), target.key === "jpg" ? "image/jpeg" : "image/png", 0.92);
      out.push({ name: `${base} ${i + 1}.${target.key}`, blob });
      ctx.progress?.((i + 1) / pages.length);
    }
    return out;
  }
  if (target.key === "pdf") {
    const JsPDF = await loadJsPdf();
    const pdf = new JsPDF({ orientation: "landscape", unit: "pt", format: [720, 405] });
    for (let i = 0; i < pages.length; i += 1) {
      if (i) pdf.addPage([720, 405], "landscape");
      const data = drawSlide(pages[i], 1600, 900).toDataURL("image/jpeg", 0.92);
      pdf.addImage(data, "JPEG", 0, 0, 720, 405);
      ctx.progress?.((i + 1) / pages.length);
    }
    return [{ name: `${base}.pdf`, blob: pdf.output("blob") }];
  }
  if (target.key === "pptx") {
    const PptxGenJS = await loadPptxGen();
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: "A2Z", width: 10, height: 5.63 });
    pptx.layout = "A2Z";
    for (const page of pages) {
      const slide = pptx.addSlide();
      slide.addText(page.paras[0] || "", { x: 0.45, y: 0.35, w: 9.1, h: 1.2, fontSize: 28, bold: true, color: "282B29" });
      if (page.paras.length > 1) {
        slide.addText(page.paras.slice(1).map((p) => `•  ${p}`).join("\n"), { x: 0.55, y: 1.65, w: 8.9, h: 3.4, fontSize: 16, color: "4B5049", breakLine: false });
      }
    }
    const blob = await pptx.write({ outputType: "blob" });
    return [{ name: `${base}.pptx`, blob }];
  }
  if (target.key === "odp") {
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    zip.file("mimetype", "application/vnd.oasis.opendocument.presentation", { compression: "STORE" });
    zip.file("META-INF/manifest.xml",
      `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.presentation"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`);
    const slideXml = pages.map((page) => `<draw:page draw:name="Slide" draw:master-page-name="Default"><draw:frame draw:name="Title" draw:style-name="Title" svg:width="24cm" svg:height="3cm" svg:x="2cm" svg:y="1cm"><draw:text-box><text:p>${xmlEscape(page.paras[0] || "")}</text:p></draw:text-box></draw:frame>${page.paras.slice(1).map((p, i) => `<draw:frame draw:style-name="Text" svg:width="24cm" svg:height="1.2cm" svg:x="2cm" svg:y="${4 + i}cm"><draw:text-box><text:p>${xmlEscape(p)}</text:p></draw:text-box></draw:frame>`).join("")}</draw:page>`).join("");
    zip.file("content.xml",
      `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.2"><office:body><office:presentation>${slideXml}</office:presentation></office:body></office:document-content>`);
    return [{ name: `${base}.odp`, blob: await zip.generateAsync({ type: "blob", compression: "DEFLATE" }) }];
  }
  throw new Error(`No slide conversion for ${target.key}.`);
}

/* ----------------------------------------------------------- spreadsheets */
async function readWorkbook(card) {
  const XLSX = await loadXlsx();
  const ext = extension(card.name);
  if (ext === "csv" || ext === "tsv") {
    const text = await card.blob.text();
    return XLSX.read(text, { type: "string", raw: false });
  }
  return XLSX.read(await card.blob.arrayBuffer(), { type: "array", cellDates: true });
}

function sheetMatrix(XLSX, wb, name) {
  const ws = wb.Sheets[name];
  return ws ? XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) : [];
}

export async function convertSheet(card, target, opts = {}, ctx = {}) {
  const XLSX = await loadXlsx();
  const wb = await readWorkbook(card);
  const base = stem(card.name);
  const names = wb.SheetNames;
  if (target.key === "xlsx" || target.key === "ods") {
    const out = XLSX.write(wb, { bookType: target.key, type: "array" });
    return [{ name: `${base}.${target.key}`, blob: new Blob([out], { type: target.key === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.oasis.opendocument.spreadsheet" }) }];
  }
  if (target.key === "csv" || target.key === "tsv") {
    if (names.length === 1) {
      const out = XLSX.utils.sheet_to_csv(wb.Sheets[names[0]], { FS: target.key === "tsv" ? "\t" : "," });
      return [{ name: `${base}.${target.key}`, blob: new Blob([out], { type: target.key === "csv" ? "text/csv" : "text/tab-separated-values" }) }];
    }
    const results = [];
    for (const name of names) {
      const out = XLSX.utils.sheet_to_csv(wb.Sheets[name], { FS: target.key === "tsv" ? "\t" : "," });
      results.push({ name: `${base} ${safeSheet(name)}.${target.key}`, blob: new Blob([out], { type: target.key === "csv" ? "text/csv" : "text/tab-separated-values" }) });
    }
    return results;
  }
  if (target.key === "html") {
    const body = names.map((name) => `<h2>${escapeHtml(name)}</h2>${XLSX.utils.sheet_to_html(wb.Sheets[name], { header: "", footer: "" })}`).join("\n");
    return [{ name: `${base}.html`, blob: new Blob([`<!doctype html><meta charset="utf-8"><title>${escapeHtml(base)}</title><style>body{font-family:system-ui;padding:24px}table{border-collapse:collapse;margin-bottom:32px}td,th{border:1px solid #ddd;padding:6px 10px;font-size:13px}h2{font-family:system-ui}</style>${body}`], { type: "text/html" }) }];
  }
  if (target.key === "pdf") {
    const JsPDF = await loadJsPdf(true);
    const pdf = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    let first = true;
    for (const name of names) {
      const rows = sheetMatrix(XLSX, wb, name);
      if (!first) pdf.addPage();
      first = false;
      pdf.setFontSize(14);
      pdf.text(name, 36, 36);
      if (rows.length) {
        pdf.autoTable({ startY: 48, head: [rows[0].map(String)], body: rows.slice(1).map((r) => r.map(String)), styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [243, 91, 40] }, margin: { left: 36, right: 36 } });
      }
      ctx.progress?.(names.indexOf(name) / names.length);
    }
    return [{ name: `${base}.pdf`, blob: pdf.output("blob") }];
  }
  throw new Error(`No spreadsheet conversion for ${target.key}.`);
}

function safeSheet(name) {
  return String(name || "Sheet").replace(/[\\/:*?"<>|]/g, "-").slice(0, 48);
}

export async function runSheetTool(card, tool) {
  if (tool.key !== "remove_meta") throw new Error(`Unknown spreadsheet tool: ${tool.key}`);
  const XLSX = await loadXlsx();
  const wb = await readWorkbook(card);
  const ext = extension(card.name);
  const type = ["xlsx", "xls", "ods"].includes(ext) ? (ext === "xls" ? "xlsx" : ext) : "xlsx";
  const out = XLSX.write(wb, { bookType: type, type: "array" });
  return [{ name: `${stem(card.name)} Clean.${type}`, blob: new Blob([out]) }];
}

export { blocksFromHtml, blocksToPdf };
