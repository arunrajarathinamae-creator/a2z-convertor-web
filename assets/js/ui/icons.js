/* Hand-drawn icon set.  Line icons for the furniture; little coloured file
 * objects for formats, so the stage reads at a glance. */

const P = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>',
  star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
  batch: '<path d="M4 7h9M4 12h9M4 17h9"/><path d="M17 8h4v10h-4z"/><path d="M19 5v3"/>',
  arrows: '<path d="M4 9h14l-3-3M20 15H6l3 3"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4 4 3 3-2 4 3"/>',
  video: '<rect x="3" y="5.5" width="12.5" height="13" rx="2.4"/><path d="M15.5 10l5-3v10l-5-3z"/>',
  audio: '<path d="M9 18V6l9-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="15.5" cy="16" r="2.5"/>',
  document: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 12h6M9 16h6"/>',
  slides: '<rect x="3" y="4.5" width="18" height="13" rx="2"/><path d="M12 17.5V21M8 21h8"/><path d="M7 8h6M7 12h10"/>',
  sheet: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4v16M15 4v16"/>',
  archive: '<path d="M4 7.5h16v13H4z"/><path d="M3 4h18v3.5H3z"/><path d="M10 11h4"/>',
  subtitle: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6.5 12h4M13 12h4M6.5 15.5h7"/>',
  tools: '<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.2-2.2z"/>',
  folder: '<path d="M3.5 7h6l2 2h9v10.5h-17z"/>',
  "folder-open": '<path d="M3.5 8h6l2 2h8.5v2"/><path d="M3.5 8v11.5h15l2-7H6.5z"/>',
  chevronLeft: '<path d="M14.5 6l-6 6 6 6"/>',
  chevronRight: '<path d="M9.5 6l6 6-6 6"/>',
  chevronDown: '<path d="M6 9.5l6 6 6-6"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4.5" cy="6" r=".8" fill="currentColor"/><circle cx="4.5" cy="12" r=".8" fill="currentColor"/><circle cx="4.5" cy="18" r=".8" fill="currentColor"/>',
  trash: '<path d="M4.5 7h15M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.4-2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>',
  moon: '<path d="M20 15.2A8.2 8.2 0 0 1 8.8 4 8.2 8.2 0 1 0 20 15.2z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 3.4 2.5c-.7.3-1.1.9-1.1 1.7v.4"/><circle cx="11.8" cy="17.3" r=".9" fill="currentColor"/>',
  download: '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M4.5 17v3h15v-3"/>',
  copy: '<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  "copy-path": '<path d="M4 6h10M4 11h7M4 16h5"/><path d="M13 16l3 3 5-6"/>',
  rename: '<path d="M4 20h16"/><path d="M6 16l9.5-9.5 3 3L9 19H6z"/><path d="M14 8l2 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r="1" fill="currentColor"/>',
  select: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><path d="M8 12h8"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  crop: '<path d="M6 3v13a2 2 0 0 0 2 2h13"/><path d="M3 6h13a2 2 0 0 1 2 2v13"/>',
  rotate: '<path d="M4 10a8 8 0 1 1 2 7"/><path d="M4 5v5h5"/>',
  resize: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 15l6-6M9 9h6v6"/>',
  compress: '<path d="M9 4v5H4M15 20v-5h5"/><path d="M4 9l5-5M20 15l-5 5"/>',
  watermark: '<path d="M4 18l5-10 4 7 3-5 4 8H4z"/><circle cx="8" cy="7" r="2"/>',
  strip: '<path d="M4 4h16M4 20h16"/><path d="M8 9h8M8 13h5"/><path d="M16 12l4 4M20 12l-4 4"/>',
  merge: '<path d="M7 4v4a4 4 0 0 0 4 4h6"/><path d="M7 20v-4a4 4 0 0 1 4-4h6"/><path d="M14 8l3 4-3 4"/>',
  split: '<path d="M12 3v18"/><path d="M4 7l4 5-4 5M20 7l-4 5 4 5"/>',
  trim: '<path d="M4 8h16M4 16h16"/><path d="M8 4v16M16 4v16"/>',
  speed: '<path d="M4 12a8 8 0 1 1 16 0"/><path d="M12 12l5-4"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  snapshot: '<path d="M4 8h4l2-3h4l2 3h4v12H4z"/><circle cx="12" cy="14" r="3.5"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  normalise: '<path d="M4 12h3l2-5 3 10 3-8 2 3h3"/>',
  extract: '<path d="M12 3v10M8 9l4 4 4-4"/><path d="M4 14v6h16v-6"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10z"/>',
  keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  cursor: '<path d="M5 3l14 8-6 1.5L10 19z"/>',
  minimize: '<path d="M5 12h14"/>',
};

export function icon(name, size = 18, cls = "") {
  const path = P[name] || P.file;
  return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function brandLogo(size = 44) {
  return `<svg class="brand-logo" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="a2zLogo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8b5f"/><stop offset="1" stop-color="#f35b28"/></linearGradient></defs>
    <rect width="64" height="64" rx="16" fill="url(#a2zLogo)"/>
    <path d="M20 39c0-9 7-16 16-16h7" fill="none" stroke="#fff" stroke-width="5.4" stroke-linecap="round"/>
    <path d="M35 16l8 7-8 7" fill="none" stroke="#fff" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="22" cy="46" r="4.6" fill="#fff" opacity=".92"/>
  </svg>`;
}

const IMAGE_COLORS = {
  jpg: ["#ff8a65", "#e64a2e"], jpeg: ["#ff8a65", "#e64a2e"],
  png: ["#63d68a", "#1f9d55"], webp: ["#40d3c0", "#0b8f88"],
  gif: ["#9b8cff", "#6b4ce6"], tiff: ["#4fc3e8", "#0b7285"],
  tif: ["#4fc3e8", "#0b7285"], avif: ["#a78bfa", "#5f3dc4"],
  heic: ["#b0b6b4", "#70777a"], heif: ["#b0b6b4", "#70777a"],
  bmp: ["#ffc078", "#e8590c"], ico: ["#74c0fc", "#1c7ed6"],
  svg: ["#ffa94d", "#e8590c"], pdf: ["#ff6b6b", "#c92a2a"],
  mp4: ["#74a2ff", "#3b5bdb"], mov: ["#8ea8ff", "#364fc7"],
  mkv: ["#4dd4e8", "#0b7285"], webm: ["#4cd6a8", "#087f5b"],
  gifv: ["#9b8cff", "#6b4ce6"], mp3: ["#ffa94d", "#d9480f"],
  m4a: ["#f783ac", "#a61e4d"], wav: ["#ffd43b", "#e67700"],
  flac: ["#b197fc", "#6741d9"], ogg: ["#66d9e8", "#0b7285"],
  opus: ["#9775fa", "#5f3dc4"], aiff: ["#faa2c1", "#a61e4d"],
  docx: ["#74a2ff", "#1971c2"], doc: ["#74a2ff", "#1971c2"],
  odt: ["#8ea8ff", "#1864ab"], rtf: ["#a5b4fc", "#364fc7"],
  md: ["#94d82d", "#5c940d"], markdown: ["#94d82d", "#5c940d"],
  txt: ["#ced4da", "#868e96"], html: ["#ffa94d", "#e8590c"],
  htm: ["#ffa94d", "#e8590c"], epub: ["#69db7c", "#2b8a3e"],
  pptx: ["#ffa8a8", "#c92a2a"], ppt: ["#ffa8a8", "#c92a2a"],
  odp: ["#ffc9c9", "#e03131"], key: ["#b0b6b4", "#70777a"],
  xlsx: ["#69db7c", "#2b8a3e"], xls: ["#69db7c", "#2b8a3e"],
  ods: ["#8ce99a", "#2f9e44"], csv: ["#a9e34b", "#5c940d"],
  tsv: ["#a9e34b", "#5c940d"], numbers: ["#b0b6b4", "#70777a"],
  srt: ["#66d9e8", "#0b7285"], vtt: ["#99e9f2", "#0c8599"],
  zip: ["#ffd43b", "#e67700"], tar: ["#ffc078", "#d9480f"],
  gz: ["#ffd8a8", "#e8590c"], gzip: ["#ffd8a8", "#e8590c"],
  tgz: ["#ffd8a8", "#e8590c"], bz2: ["#ffd8a8", "#e8590c"],
  xz: ["#ffd8a8", "#e8590c"], rar: ["#ffd8a8", "#e8590c"],
  "7z": ["#ffd8a8", "#e8590c"],
};

function glyphFor(ext) {
  if (["jpg", "jpeg", "png", "webp", "gif", "tiff", "tif", "avif", "heic", "heif", "bmp", "ico", "svg"].includes(ext)) return P.image;
  if (["mp4", "mov", "mkv", "webm", "avi", "wmv", "m4v", "flv", "mpg", "mpeg"].includes(ext)) return P.video;
  if (["mp3", "m4a", "wav", "flac", "ogg", "oga", "opus", "aiff", "aif", "wma"].includes(ext)) return P.audio;
  if (["pdf"].includes(ext)) return P.document;
  if (["docx", "doc", "odt", "pages", "rtf", "rtfd", "md", "markdown", "txt", "html", "htm", "epub"].includes(ext)) return P.document;
  if (["ppt", "pptx", "key", "odp"].includes(ext)) return P.slides;
  if (["xlsx", "xls", "ods", "csv", "tsv", "numbers"].includes(ext)) return P.sheet;
  if (["srt", "vtt"].includes(ext)) return P.subtitle;
  if (["zip", "tar", "gz", "tgz", "bz2", "xz", "rar", "7z"].includes(ext)) return P.archive;
  return P.file;
}

export function formatIcon(ext, size = 38, label = "") {
  const key = String(ext || "").toLowerCase();
  const [a, b] = IMAGE_COLORS[key] || ["#b0b6b4", "#70777a"];
  const glyph = glyphFor(key);
  const text = label || (key ? key.toUpperCase().slice(0, 4) : "");
  return `<span class="fmt-icon" style="--f1:${a};--f2:${b};width:${size}px;height:${size}px">
    <svg viewBox="0 0 24 24" width="${Math.round(size * 0.54)}" height="${Math.round(size * 0.54)}" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyph}</svg>
    ${text && size >= 34 ? `<b>${text}</b>` : ""}
  </span>`;
}

export function categoryIcon(cat, size = 18) {
  return icon(cat || "file", size);
}
