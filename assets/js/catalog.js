/* A2Z Convertor Web — the catalogue.
 *
 * The same knowledge base as the desktop app: nine families, their readable
 * extensions, the formats they can become, and the tools that edit a copy.
 * The browser can do most of it; a target the browser genuinely cannot do is
 * kept in the catalogue, greyed, and explains itself instead of disappearing.
 */

export const CATEGORIES = [
  {
    key: "image", label: "Images", icon: "image", accent: "#f35b28",
    extensions: ["jpg", "jpeg", "png", "webp", "heic", "heif", "tiff", "tif",
      "bmp", "gif", "svg", "ico", "avif", "jfif", "ppm"],
    outputs: [
      f("png", "PNG"), f("jpg", "JPG"), f("webp", "WebP"),
      f("heic", "HEIC"), f("tiff", "TIFF"), f("avif", "AVIF"),
      f("pdf", "PDF"), f("bmp", "BMP"), f("ico", "ICO"), f("gif", "GIF"),
    ],
    tools: [
      t("compress_image", "Compress", "compress", "Compressing image", true),
      t("crop_image", "Crop", "crop", "Cropping image", true),
      t("rotate_image", "Rotate", "rotate", "Rotating image", true),
      t("resize_image", "Resize", "resize", "Resizing image", true),
      t("watermark", "Watermark", "watermark", "Watermarking image", true),
      t("remove_meta", "Strip meta", "strip", "Stripping metadata"),
      t("merge", "Merge", "merge", "Merging images", true),
    ],
  },
  {
    key: "video", label: "Video", icon: "video", accent: "#4c6ef5",
    extensions: ["mp4", "mov", "mkv", "webm", "avi", "wmv", "m4v", "flv", "mpg", "mpeg"],
    outputs: [
      f("mp4", "MP4"), f("mov", "MOV"), f("mkv", "MKV"), f("webm", "WebM"),
      f("gif", "GIF"), f("mp3", "MP3", "Extracting MP3"),
      f("m4a", "M4A", "Extracting M4A"), f("wav", "WAV", "Extracting WAV"),
    ],
    tools: [
      t("trim", "Trim", "trim", "Trimming video", true),
      t("crop_video", "Crop", "crop", "Cropping video", true),
      t("compress_video", "Compress", "compress", "Compressing video", true),
      t("split", "Split", "split", "Splitting video", true),
      t("merge", "Merge", "merge", "Merging videos", true),
      t("rotate_video", "Rotate", "rotate", "Rotating video", true),
      t("speed", "Speed", "speed", "Changing speed", true),
      t("snapshot", "Snapshot", "snapshot", "Taking snapshot", true),
      t("mute", "Mute", "mute", "Muting video"),
      t("remove_meta", "Strip meta", "strip", "Stripping metadata"),
    ],
  },
  {
    key: "audio", label: "Audio", icon: "audio", accent: "#e8590c",
    extensions: ["mp3", "m4a", "wav", "flac", "ogg", "oga", "opus", "aiff", "aif", "wma"],
    outputs: [
      f("mp3", "MP3"), f("m4a", "M4A"), f("wav", "WAV"), f("flac", "FLAC"),
      f("ogg", "OGG"), f("opus", "Opus"), f("aiff", "AIFF"),
    ],
    tools: [
      t("trim", "Trim", "trim", "Trimming audio", true),
      t("compress_audio", "Compress", "compress", "Compressing audio", true),
      t("split", "Split", "split", "Splitting audio", true),
      t("merge", "Merge", "merge", "Merging audio", true),
      t("speed", "Speed", "speed", "Changing speed", true),
      t("normalise", "Normalise", "normalise", "Normalising audio"),
      t("remove_meta", "Strip meta", "strip", "Stripping metadata"),
    ],
  },
  {
    key: "pdf", label: "PDF", icon: "pdf", accent: "#e03131",
    extensions: ["pdf"],
    outputs: [
      f("txt", "TXT"), f("md", "MD"),
      f("jpg", "JPG", "Rendering pages to JPG"),
      f("png", "PNG", "Rendering pages to PNG"),
      f("pptx", "PPTX"), f("epub", "EPUB"),
    ],
    tools: [
      t("split", "Split", "split", "Splitting PDF", true),
      t("merge", "Merge", "merge", "Merging PDFs", true),
      t("compress_pdf", "Compress", "compress", "Compressing PDF", true),
      t("rotate_pdf", "Rotate", "rotate", "Rotating pages", true),
      t("remove_meta", "Strip meta", "strip", "Stripping metadata"),
    ],
  },
  {
    key: "document", label: "Documents", icon: "document", accent: "#1971c2",
    extensions: ["docx", "doc", "odt", "pages", "rtf", "rtfd", "md", "markdown",
      "txt", "text", "epub", "html", "htm"],
    outputs: [
      f("pdf", "PDF"), f("docx", "DOCX"), f("odt", "ODT"),
      f("md", "MD"), f("txt", "TXT"), f("html", "HTML"), f("epub", "EPUB"),
      f("rtf", "RTF"),
    ],
    tools: [t("remove_meta", "Strip meta", "strip", "Stripping metadata")],
  },
  {
    key: "slides", label: "Slides", icon: "slides", accent: "#d6336c",
    extensions: ["ppt", "pptx", "key", "odp"],
    outputs: [
      f("pdf", "PDF"), f("jpg", "JPG", "Rendering slides to JPG"),
      f("png", "PNG", "Rendering slides to PNG"), f("pptx", "PPTX"),
      f("odp", "ODP"),
    ],
    tools: [t("remove_meta", "Strip meta", "strip", "Stripping metadata")],
  },
  {
    key: "sheet", label: "Spreadsheets", icon: "sheet", accent: "#2f9e44",
    extensions: ["xlsx", "xls", "ods", "csv", "tsv", "numbers"],
    outputs: [
      f("xlsx", "XLSX"), f("ods", "ODS"), f("csv", "CSV"), f("tsv", "TSV"),
      f("pdf", "PDF"), f("html", "HTML"),
    ],
    tools: [t("remove_meta", "Strip meta", "strip", "Stripping metadata")],
  },
  {
    key: "subtitle", label: "Subtitles", icon: "subtitle", accent: "#0c8599",
    extensions: ["srt", "vtt"],
    outputs: [f("srt", "SRT"), f("vtt", "VTT"), f("txt", "TXT")],
    tools: [
      t("shift_time", "Shift time", "speed", "Shifting timestamps", true),
      t("remove_meta", "Strip meta", "strip", "Stripping metadata"),
    ],
  },
  {
    key: "archive", label: "Archives", icon: "archive", accent: "#f08c00",
    extensions: ["zip", "tar", "gz", "tgz", "bz2", "xz", "rar", "7z"],
    outputs: [f("zip", "ZIP"), f("tar", "TAR"), f("gzip", "GZIP")],
    tools: [
      t("extract", "Extract", "extract", "Extracting archive"),
      t("compress_archive", "Recompress", "compress", "Recompressing", true),
    ],
  },
];

export const FILE_ACTIONS = [
  a("download", "Download", "download", "Save this file to your computer"),
  a("copy", "Copy file", "copy", "Copy the file to the clipboard"),
  a("copy_name", "Copy name", "copy-path", "Copy the file name"),
  a("duplicate", "Duplicate", "copy", "Duplicate beside the original"),
  a("rename", "Rename", "rename", "Rename on the desk"),
  a("favorite", "Favorite", "star", "Pin to Favorites"),
  a("info", "Info", "info", "Show size, type and dates"),
  a("remove", "Remove", "trash", "Remove from the desk"),
  a("select_all", "Select all", "select", "Select every file on the desk"),
];

export const GENERIC_TOOLS = [
  t("compress_archive", "Compress", "compress", "Compressing files", true),
  t("extract", "Extract", "extract", "Extracting archive"),
];

export const OPTION_FIELDS = {
  // image conversions shown in the inspector
  jpg: { quality: { label: "Quality", type: "range", min: 20, max: 95, step: 1, value: 92, hint: "Higher keeps more detail and makes a bigger file" } },
  webp: { quality: { label: "Quality", type: "range", min: 20, max: 95, step: 1, value: 92, hint: "Higher keeps more detail and makes a bigger file" } },
  avif: { quality: { label: "Quality", type: "range", min: 20, max: 95, step: 1, value: 70 } },
  pdf: { dpi: { label: "Page resolution", type: "range", min: 72, max: 300, step: 1, value: 150, hint: "Dots per inch for the rendered page" } },

  compress_image: {
    quality: { label: "Quality", type: "range", min: 10, max: 95, step: 1, value: 78 },
    max_width: { label: "Max width", type: "number", min: 0, max: 12000, step: 10, value: 0, hint: "0 keeps the original size" },
  },
  crop_image: {
    left: { label: "Left", type: "range", min: 0, max: 45, step: 1, value: 8, unit: "%" },
    right: { label: "Right", type: "range", min: 0, max: 45, step: 1, value: 8, unit: "%" },
    top: { label: "Top", type: "range", min: 0, max: 45, step: 1, value: 8, unit: "%" },
    bottom: { label: "Bottom", type: "range", min: 0, max: 45, step: 1, value: 8, unit: "%" },
  },
  rotate_image: {
    angle: { label: "Angle", type: "select", options: [["90", "90° clockwise"], ["180", "180°"], ["270", "90° counter-clockwise"]], value: "90" },
    flip: { label: "Flip horizontally", type: "check", value: false },
  },
  resize_image: {
    width: { label: "Width", type: "number", min: 1, max: 20000, step: 1, value: 0, unit: "px" },
    height: { label: "Height", type: "number", min: 1, max: 20000, step: 1, value: 0, unit: "px" },
    keep: { label: "Keep aspect ratio", type: "check", value: true },
  },
  watermark: {
    text: { label: "Text", type: "text", value: "A2Z", maxlength: 40 },
    opacity: { label: "Opacity", type: "range", min: 5, max: 100, step: 1, value: 60, unit: "%" },
    size: { label: "Size", type: "range", min: 2, max: 30, step: 1, value: 7, unit: "%" },
    position: { label: "Position", type: "select", options: [["center", "Center"], ["bottom-right", "Bottom right"], ["bottom-left", "Bottom left"], ["top-right", "Top right"], ["tile", "Tiled"]], value: "bottom-right" },
  },
  merge: {
    direction: { label: "Direction", type: "select", options: [["horizontal", "Horizontal"], ["vertical", "Vertical"]], value: "horizontal" },
    gap: { label: "Gap", type: "range", min: 0, max: 80, step: 1, value: 0, unit: "px" },
  },

  trim: {
    start: { label: "Start", type: "number", min: 0, max: 86400, step: 0.1, value: 0, unit: "s" },
    end: { label: "End", type: "number", min: 0, max: 86400, step: 0.1, value: 0, unit: "s", hint: "0 means the end of the file" },
  },
  crop_video: {
    width: { label: "Width", type: "number", min: 2, max: 7680, step: 2, value: 0, unit: "px", hint: "0 uses the source size" },
    height: { label: "Height", type: "number", min: 2, max: 4320, step: 2, value: 0, unit: "px", hint: "0 uses the source size" },
    x: { label: "Left", type: "number", min: 0, max: 7680, step: 2, value: 0, unit: "px" },
    y: { label: "Top", type: "number", min: 0, max: 4320, step: 2, value: 0, unit: "px" },
  },
  compress_video: {
    crf: { label: "Quality", type: "range", min: 18, max: 34, step: 1, value: 26, hint: "Lower is better quality and bigger" },
  },
  split: {
    parts: { label: "Parts", type: "range", min: 2, max: 20, step: 1, value: 2, hint: "Split into equal pieces" },
  },
  rotate_video: {
    angle: { label: "Angle", type: "select", options: [["90", "90° clockwise"], ["180", "180°"], ["270", "90° counter-clockwise"]], value: "90" },
  },
  speed: {
    factor: { label: "Speed", type: "range", min: 0.25, max: 4, step: 0.25, value: 2, unit: "×" },
  },
  snapshot: {
    at: { label: "At", type: "number", min: 0, max: 86400, step: 0.1, value: 0, unit: "s" },
    format: { label: "Format", type: "select", options: [["png", "PNG"], ["jpg", "JPG"]], value: "png" },
  },
  compress_audio: {
    bitrate: { label: "Bitrate", type: "select", options: [["64k", "64 kbps"], ["96k", "96 kbps"], ["128k", "128 kbps"], ["192k", "192 kbps"], ["256k", "256 kbps"]], value: "128k" },
  },
  split_pdf: {
    ranges: { label: "Pages", type: "text", value: "", placeholder: "1-3, 5, 8-10 — empty means every page", wide: true },
  },
  rotate_pdf: {
    angle: { label: "Angle", type: "select", options: [["90", "90° clockwise"], ["180", "180°"], ["270", "90° counter-clockwise"]], value: "90" },
  },
  compress_pdf: {
    level: { label: "Mode", type: "select", options: [["clean", "Clean re-save (lossless)"]], value: "clean" },
  },
  shift_time: {
    seconds: { label: "Shift by", type: "number", min: -86400, max: 86400, step: 0.1, value: 1, unit: "s" },
  },
  compress_archive: {
    format: { label: "Format", type: "select", options: [["zip", "ZIP"], ["tar", "TAR"], ["gzip", "GZIP"]], value: "zip" },
    level: { label: "Compression", type: "range", min: 1, max: 9, step: 1, value: 6 },
  },
  batch: {
    format: { label: "Convert to", type: "select", options: [], value: "" },
    quality: { label: "Quality", type: "range", min: 20, max: 95, step: 1, value: 90 },
  },
};

// ------------------------------------------------------------------ helpers
function f(key, label, verb) {
  return {
    key, label: label || key.toUpperCase(), kind: "format",
    verb: verb || `Converting to ${label || key.toUpperCase()}`,
  };
}

function t(key, label, icon, hint, needsOptions = false) {
  return { key, label, kind: "tool", icon, hint, verb: hint || label, needsOptions };
}

function a(key, label, icon, hint) {
  return { key, label, kind: "action", icon, hint, verb: hint || label };
}

const BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
const EXT_TO_CATEGORY = new Map();
for (const c of CATEGORIES) {
  for (const e of c.extensions) if (!EXT_TO_CATEGORY.has(e)) EXT_TO_CATEGORY.set(e, c);
}

export function extension(name = "") {
  const base = name.split(/[\\/]/).pop();
  const i = base.lastIndexOf(".");
  return i > 0 ? base.slice(i + 1).toLowerCase() : "";
}

export function stem(name = "") {
  const base = name.split(/[\\/]/).pop();
  const i = base.lastIndexOf(".");
  return i > 0 ? base.slice(0, i) : base;
}

export function categoryFor(name) {
  return EXT_TO_CATEGORY.get(extension(name)) || null;
}

export function categoryByKey(key) {
  return BY_KEY[key] || null;
}

const ALIASES = {
  jpeg: "jpg", tif: "tiff", heif: "heic", aif: "aiff", markdown: "md",
  htm: "html", oga: "ogg", jfif: "jpg", text: "txt", mpeg: "mp4",
  mpg: "mp4", m4v: "mp4", key: "pptx", numbers: "xlsx", pages: "docx",
  odp: "pptx", doc: "docx", xls: "xlsx", ppt: "pptx", rtfd: "rtf",
};

export function ownKey(name) {
  const ext = extension(name);
  return ALIASES[ext] || ext;
}

export function formatsFor(name) {
  const cat = categoryFor(name);
  if (!cat) return [];
  const own = ownKey(name);
  return cat.outputs.filter((t) => t.key !== own);
}

export function toolsFor(name) {
  const cat = categoryFor(name);
  return cat ? cat.tools.slice() : GENERIC_TOOLS.slice();
}

export function actionsFor() {
  return FILE_ACTIONS.slice();
}

/* Which inputs this browser can genuinely open.  A null reason means yes. */
export function readReason(name) {
  const ext = extension(name);
  const cat = categoryFor(name);
  if (!cat) return "This file type is not in the catalogue.";
  switch (cat.key) {
    case "image":
      if (["heic", "heif"].includes(ext)) return "This browser cannot decode HEIC. The desktop build can.";
      if (ext === "ppm") return "PPM needs the desktop build's image engine.";
      return "";
    case "video":
      if (["wmv", "flv", "mpg", "mpeg"].includes(ext)) return "This browser cannot read this video container. Try MP4, MOV, MKV or WebM.";
      return "";
    case "audio":
      if (ext === "wma") return "This browser cannot read WMA. Try MP3, M4A, WAV or FLAC.";
      return "";
    case "document":
      if (["doc", "pages", "rtfd"].includes(ext)) return `Reading .${ext} needs the desktop build.`;
      return "";
    case "slides":
      if (["ppt", "key"].includes(ext)) return `Reading .${ext} needs the desktop build.`;
      return "";
    case "sheet":
      if (ext === "numbers") return "Reading Numbers needs the desktop build.";
      return "";
    case "archive":
      if (["rar", "7z", "bz2", "xz"].includes(ext)) return `Reading .${ext} needs the desktop build's archive helpers.`;
      return "";
    default:
      return "";
  }
}

let avifEncode = null;
export function probeAvif() {
  if (avifEncode !== null) return avifEncode;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 4;
    avifEncode = c.toDataURL("image/avif").startsWith("data:image/avif");
  } catch {
    avifEncode = false;
  }
  return avifEncode;
}

/* Why a target cannot run on this browser and this file.  Empty means it can. */
export function whyUnsupported(target, card, selection = []) {
  const read = readReason(card.name);
  if (read) return read;
  const cat = categoryFor(card.name);
  if (!cat) return "This file is not in the catalogue.";
  if (target.kind === "format") {
    if (target.key === "heic") return "This browser has no HEIC encoder.";
    if (target.key === "avif" && !probeAvif()) return "This browser has no AVIF encoder.";
    if (card.category === "image" && target.key === "pdf" && ["svg", "tiff", "tif"].includes(card.ext)) {
      return ""; // decoded through canvas / UTIF, so a PDF is fine
    }
  }
  if (target.kind === "tool") {
    if (target.key === "merge" && selection.length < 2) {
      return `Select at least two ${cat.label.toLowerCase()} to merge.`;
    }
    if (target.key === "extract" && cat.key !== "archive") {
      return "Extract works on an archive (ZIP, TAR or GZIP).";
    }
    if (target.key === "compress_pdf") return ""; // re-save; a modest reduction, not a pretend one
  }
  return "";
}

export function conversionPathCount() {
  return CATEGORIES.reduce((n, c) => n + c.extensions.length * c.outputs.length, 0);
}

export function stats() {
  return {
    paths: conversionPathCount(),
    tools: CATEGORIES.reduce((n, c) => n + c.tools.length, 0) + GENERIC_TOOLS.length,
    actions: FILE_ACTIONS.length,
    categories: CATEGORIES.length,
  };
}

export const MIME = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  gif: "image/gif", bmp: "image/bmp", tiff: "image/tiff", ico: "image/x-icon",
  avif: "image/avif", heic: "image/heic", svg: "image/svg+xml",
  pdf: "application/pdf", txt: "text/plain", md: "text/markdown",
  html: "text/html", htm: "text/html", csv: "text/csv", tsv: "text/tab-separated-values",
  srt: "application/x-subrip", vtt: "text/vtt", rtf: "application/rtf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odp: "application/vnd.oasis.opendocument.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  epub: "application/epub+zip", zip: "application/zip",
  tar: "application/x-tar", gzip: "application/gzip", gz: "application/gzip",
  mp4: "video/mp4", mov: "video/quicktime", mkv: "video/x-matroska",
  webm: "video/webm", avi: "video/x-msvideo", wmv: "video/x-ms-wmv",
  m4v: "video/x-m4v", flv: "video/x-flv", mpg: "video/mpeg", mpeg: "video/mpeg",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", flac: "audio/flac",
  ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/opus", aiff: "audio/aiff",
  aif: "audio/aiff", wma: "audio/x-ms-wma",
};

export function mimeFor(ext) {
  return MIME[String(ext || "").toLowerCase()] || "application/octet-stream";
}
