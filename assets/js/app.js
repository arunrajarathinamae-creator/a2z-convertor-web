/* A2Z Convertor Web — the shell.
 *
 * One desk, one selection, three ways into the same conversion: the stage
 * tiles, the wheel, and the selected-file pane.  Everything runs in the tab.
 */

import {
  CATEGORIES, GENERIC_TOOLS, actionsFor, categoryByKey, categoryFor,
  formatsFor, readReason, stats, toolsFor, whyUnsupported,
  extension, stem, ownKey,
} from "./catalog.js";
import {
  clamp, dateText, download, durationText, escapeHtml, formatBytes,
  makeZip, safeName, uid, uniqueName, writeToDirectory,
} from "./util.js";
import { icon, brandLogo, formatIcon } from "./ui/icons.js";
import { Wheel } from "./ui/wheel.js";
import { openConfirm, openFields, openModal, openText } from "./ui/dialog.js";
import { defaultOptionsFor, fieldsFor, runConversion } from "./convert/index.js";
import { imageInfo, imageThumb } from "./convert/image.js";
import { mediaDetails, mediaThumb } from "./convert/media.js";
import { pdfInfo, pdfThumb } from "./convert/pdf.js";
import { archiveInfo } from "./convert/archives.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const FAMILIES = {
  image: ["image"], video: ["video"], audio: ["audio"],
  document: ["document", "pdf", "slides", "sheet"],
  archive: ["archive"], utilities: [null, "subtitle"],
};

const SAVE_KEYS = {
  theme: "a2z.web.theme", tiles: "a2z.web.tiles", favorites: "a2z.web.favorites",
  formats: "a2z.web.formats", quality: "a2z.web.quality", search: "a2z.web.search",
};

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
  },
};

const state = {
  files: [],
  selectedId: null,
  multi: new Set(),
  view: "home",
  mode: "formats",
  stagePage: 0,
  stageKey: "",
  current: { card: null, targets: [], mode: "formats" },
  search: "",
  tiles: store.get(SAVE_KEYS.tiles, false),
  theme: store.get(SAVE_KEYS.theme, null),
  favorites: new Set(store.get(SAVE_KEYS.favorites, [])),
  lastFormat: store.get(SAVE_KEYS.formats, {}),
  quality: store.get(SAVE_KEYS.quality, {}),
  downloads: [],
  dirHandle: null,
  busy: false,
  status: "Ready",
  cancelRequested: false,
};

let wheel;
let els = {};
let dragDepth = 0;
let modifierTimer = null;
let modifierPending = null;
let renderQueued = false;

/* ------------------------------------------------------------------ boot */
function init() {
  els = {
    app: $("#app"),
    rail: $("#rail"),
    filesPane: $("#files-pane"),
    fileList: $("#file-list"),
    count: $("#file-count"),
    miniDrop: $("#mini-drop"),
    stage: $("#stage"),
    stageTitle: $("#stage-title"),
    stageSub: $("#stage-sub"),
    stageGrid: $("#stage-grid"),
    stageDots: $("#stage-dots"),
    stageEmpty: $("#stage-empty"),
    pagePrev: $("#page-prev"),
    pageNext: $("#page-next"),
    inspector: $("#inspector"),
    quickbar: $("#quickbar"),
    statusbar: $("#statusbar"),
    search: $("#search"),
    wheelLayer: $("#wheel-layer"),
    fileInput: $("#file-input"),
    folderInput: $("#folder-input"),
    dragOverlay: $("#drag-overlay"),
    themeBtn: $("#btn-theme"),
    pills: $$(".pill"),
  };

  if (!state.theme) {
    state.theme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  applyTheme(state.theme);

  // Fill the static furniture (logo, rail glyphs, top-bar buttons).  The rail
  // is re-rendered on every selection change, so this is only the first coat.
  const logo = $("#brand-logo");
  if (logo) logo.innerHTML = brandLogo(42);
  hydrateIcons(document);
  setTiles(state.tiles);

  wheel = new Wheel({
    layer: els.wheelLayer,
    getCard: () => selectedCard(),
    getSelection: () => selectionCards(),
    getTargets: (mode, card) => targetsFor(mode, card),
    whyUnsupported: (target, card, selection) => whyUnsupported(target, card, selection),
    onApply: (target, card) => handleTarget(card, target, "wheel"),
    onUnsupported: (msg) => toast(msg, "error"),
    onModeChange: (mode) => {
      state.mode = mode;
      updateModeUI();
      renderStage();
      syncWheelHint();
    },
    onHide: () => renderStage(),
  });

  bindEvents();
  renderAll();
  setStatus("Ready");

  // Keep the engine honest: show the catalogue size in the status strip.
  const s = stats();
  $(".catalogue-note")?.setAttribute("title", `${s.paths} paths · ${s.tools} tools · ${s.actions} actions`);
}

/* ------------------------------------------------------------------ theme */
function hydrateIcons(root) {
  $$("[data-icon]", root).forEach((el) => {
    if (el.innerHTML.trim()) return;
    const size = Number(el.dataset.iconSize) || (el.classList.contains("badge-ico") ? 13 : 18);
    el.innerHTML = icon(el.dataset.icon, size);
  });
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  store.set(SAVE_KEYS.theme, theme);
  if (els.themeBtn) {
    els.themeBtn.innerHTML = icon(theme === "dark" ? "sun" : "moon", 18);
    els.themeBtn.setAttribute("aria-label", theme === "dark" ? "Use light theme" : "Use dark theme");
    els.themeBtn.title = theme === "dark" ? "Light theme" : "Dark theme";
  }
}

/* ----------------------------------------------------------------- cards */
function extFromType(type) {
  if (!type) return "";
  const map = {
    "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
    "image/svg+xml": "svg", "image/bmp": "bmp", "image/tiff": "tiff", "image/avif": "avif",
    "application/pdf": "pdf", "text/plain": "txt", "text/markdown": "md", "text/html": "html",
    "text/csv": "csv", "application/zip": "zip", "application/x-tar": "tar",
    "application/gzip": "gz", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/mp4": "m4a",
    "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/epub+zip": "epub",
  };
  return map[type] || "";
}

function kindFor(card) {
  const cat = categoryByKey(card.category);
  if (!cat) return "File";
  const singular = {
    image: "Image", video: "Video", audio: "Audio", pdf: "PDF",
    document: "Document", slides: "Slides", sheet: "Spreadsheet",
    subtitle: "Subtitles", archive: "Archive",
  }[cat.key] || cat.label;
  return `${card.ext ? card.ext.toUpperCase() : "File"} ${singular}`;
}

function createCard(file, nameOverride = null) {
  const name = nameOverride || file.name || "file";
  let ext = extension(name);
  if (!ext) ext = extFromType(file.type);
  const cat = categoryFor(name) || (ext ? categoryFor(`x.${ext}`) : null);
  const previewable = ["image"].includes(cat?.key) && !["heic", "heif"].includes(ext);
  return {
    id: uid("c"),
    file,
    blob: file,
    name,
    size: file.size,
    ext,
    category: cat?.key || "other",
    categoryLabel: cat?.label || "File",
    addedAt: Date.now(),
    modified: file.lastModified || Date.now(),
    thumbURL: null,
    previewURL: previewable ? URL.createObjectURL(file) : null,
    details: { kind: "" },
    detailLoaded: false,
  };
}

function addFiles(files, { select = true, quiet = false } = {}) {
  const list = Array.from(files || []).filter((f) => f instanceof File);
  if (!list.length) return [];
  if (state.files.length >= 300) {
    toast("The desk holds 300 files. Remove a few before adding more.", "error");
    return [];
  }
  const room = list.slice(0, 300 - state.files.length);
  const cards = room.map((f) => createCard(f));
  for (const c of cards) {
    c.details = { kind: kindFor(c), sizeText: formatBytes(c.size), modifiedText: dateText(c.modified) };
    state.files.push(c);
    probeCard(c);
  }
  if (select && cards.length) selectCard(cards[cards.length - 1].id);
  renderAll();
  if (!quiet) toast(`${cards.length} file${cards.length === 1 ? "" : "s"} added`, "success");
  return cards;
}

async function probeCard(card) {
  try {
    if (card.category === "image") {
      const [info, thumb] = await Promise.all([imageInfo(card.blob, card.name), imageThumb(card.blob, card.name).catch(() => null)]);
      card.thumbURL = thumb;
      card.details = {
        ...card.details,
        dimensions: info.dimensions,
        width: info.width, height: info.height,
      };
    } else if (card.category === "video" || card.category === "audio") {
      const [details, thumb] = await Promise.all([mediaDetails(card), mediaThumb(card).catch(() => null)]);
      card.thumbURL = thumb;
      card.details = {
        ...card.details,
        dimensions: details.dimensions,
        duration: details.duration,
        meta: details.meta,
      };
    } else if (card.category === "pdf") {
      const [info, thumb] = await Promise.all([pdfInfo(card.blob), pdfThumb(card.blob).catch(() => null)]);
      card.thumbURL = thumb;
      card.details = {
        ...card.details,
        pages: info.pages,
        dimensions: info.dimensions,
      };
    } else if (card.category === "archive") {
      const info = await archiveInfo(card);
      card.details = { ...card.details, meta: info.meta, items: info.count };
    }
    card.detailLoaded = true;
  } catch {
    card.detailLoaded = true;
  }
  scheduleFilesRender();
  if (selectedCard()?.id === card.id) renderInspector();
}

function scheduleFilesRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderFiles();
  });
}

function removeCard(id, { quiet = false } = {}) {
  const i = state.files.findIndex((c) => c.id === id);
  if (i < 0) return;
  const [card] = state.files.splice(i, 1);
  if (card.previewURL) URL.revokeObjectURL(card.previewURL);
  state.multi.delete(id);
  if (state.selectedId === id) {
    state.selectedId = state.files[Math.min(i, state.files.length - 1)]?.id || null;
    state.multi = new Set(state.selectedId ? [state.selectedId] : []);
  }
  if (!quiet) toast("Removed from the desk");
  renderAll();
}

function selectedCard() {
  return state.files.find((c) => c.id === state.selectedId) || null;
}

function selectionCards() {
  const sel = state.files.filter((c) => state.multi.has(c.id));
  if (sel.length > 1) return sel;
  const one = selectedCard();
  return one ? [one] : [];
}

function selectCard(id, { additive = false, keepView = false } = {}) {
  const card = state.files.find((c) => c.id === id);
  if (!card) return;
  if (additive) {
    if (state.multi.has(id)) state.multi.delete(id);
    else state.multi.add(id);
    state.selectedId = id;
    if (!state.multi.size) state.multi.add(id);
  } else {
    state.selectedId = id;
    state.multi = new Set([id]);
  }
  if (!keepView && state.view.startsWith("tools:")) {
    const fam = state.view.split(":")[1];
    if (!FAMILIES[fam]?.includes(card.category)) state.view = "home";
  }
  state.stagePage = 0;
  renderAll();
  if (window.innerWidth <= 900) els.app.classList.remove("show-files");
}

function cardsInFamily(family) {
  const cats = FAMILIES[family] || [];
  return state.files.filter((c) => cats.includes(c.category));
}

function visibleFiles() {
  let list = state.files.slice();
  if (state.view === "recent") list.sort((a, b) => b.addedAt - a.addedAt);
  if (state.view === "favorites") list = list.filter((c) => state.favorites.has(favKey(c)));
  if (state.view.startsWith("tools:")) {
    const fam = state.view.split(":")[1];
    const cats = FAMILIES[fam] || [];
    list = list.filter((c) => cats.includes(c.category));
  }
  const q = state.search.trim().toLowerCase();
  if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));
  return list;
}

function favKey(card) {
  return `${card.name}::${card.size}`;
}

function metaLine(card) {
  const bits = [formatBytes(card.size)];
  if (card.details?.meta) bits.push(card.details.meta);
  else {
    if (card.details?.dimensions) bits.push(card.details.dimensions);
    if (card.details?.duration) bits.push(card.details.duration);
  }
  if (card.category === "pdf" && card.details?.pages) bits.push(`${card.details.pages} page${card.details.pages === 1 ? "" : "s"}`);
  return bits.filter(Boolean).join(" · ");
}

/* ----------------------------------------------------------------- targets */
function targetsFor(mode, card) {
  if (!card) return [];
  if (mode === "formats") return formatsFor(card.name);
  if (mode === "tools") return toolsFor(card.name);
  return actionsFor();
}

function currentMode() {
  if (state.view.startsWith("tools:")) return "tools";
  if (state.view === "format" || state.view === "batch") return "formats";
  return state.mode;
}

function cardsOfKind(card) {
  return card ? state.files.filter((c) => c.category === card.category) : [];
}

/* --------------------------------------------------------------- rendering */
function renderAll() {
  renderRail();
  renderFiles();
  renderStage();
  renderInspector();
  renderQuickbar();
  renderStatus();
  updateModeUI();
}

function renderRail() {
  $$(".rail [data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === state.view);
    const ico = b.querySelector(".nav-ico");
    if (ico && !ico.innerHTML.trim()) ico.innerHTML = icon(b.dataset.icon, 17);
  });
}

function fileThumb(card, size = 36) {
  if (card.thumbURL) {
    return `<span class="thumb" style="width:${size}px;height:${Math.round(size * 0.8)}px"><img src="${card.thumbURL}" alt=""></span>`;
  }
  return formatIcon(card.ext, size);
}

function renderFiles() {
  const list = visibleFiles();
  els.count.textContent = String(state.files.length);
  if (!state.files.length) {
    els.fileList.innerHTML = `<div class="empty-desk">
      <div class="empty-art">${formatIcon("png", 48)}${formatIcon("pdf", 48)}${formatIcon("mp4", 48)}</div>
      <b>No files yet</b>
      <span>Drop files anywhere, or press <em>Add Files</em>.</span>
    </div>`;
    return;
  }
  if (!list.length) {
    els.fileList.innerHTML = `<div class="nothing">
      <b>${state.search ? "Nothing matches" : "Nothing here yet"}</b>
      <span>${state.search ? `No file on the desk is called “${escapeHtml(state.search)}”.` : "Add a file with the button above."}</span>
    </div>`;
    return;
  }
  const tiles = state.tiles;
  els.fileList.className = `file-list${tiles ? " tiles" : ""}`;
  els.fileList.innerHTML = list.map((card) => {
    const active = card.id === state.selectedId;
    const checked = state.multi.has(card.id);
    const fav = state.favorites.has(favKey(card));
    if (tiles) {
      return `<div class="file-tile${active ? " active" : ""}" data-id="${card.id}" title="${escapeHtml(card.name)}">
        <div class="file-tile-thumb">${fileThumb(card, 54)}${fav ? `<span class="fav-dot">${icon("star", 10)}</span>` : ""}</div>
        <div class="file-tile-name">${escapeHtml(card.name)}</div>
        <div class="file-tile-meta">${escapeHtml(metaLine(card))}</div>
        <button class="check${checked ? " on" : ""}" data-check="${card.id}" title="Include in a merge" aria-label="Select ${escapeHtml(card.name)}">${checked ? icon("check", 11) : ""}</button>
      </div>`;
    }
    return `<div class="file-row${active ? " active" : ""}" data-id="${card.id}" title="${escapeHtml(card.name)}">
      ${fileThumb(card, 36)}
      <div class="file-text">
        <div class="file-name">${escapeHtml(card.name)}${fav ? ` <span class="fav-star">${icon("star", 10)}</span>` : ""}</div>
        <div class="file-meta">${escapeHtml(metaLine(card))}</div>
      </div>
      <button class="check${checked ? " on" : ""}" data-check="${card.id}" title="Include in a merge" aria-label="Select ${escapeHtml(card.name)}">${checked ? icon("check", 11) : ""}</button>
    </div>`;
  }).join("");
}

function singularFor(catLabel) {
  return {
    Images: "image", Video: "video", Audio: "audio", PDF: "PDF",
    Documents: "document", Slides: "slide", Spreadsheets: "spreadsheet",
    Subtitles: "subtitle", Archives: "archive",
  }[catLabel] || "file";
}

function renderStage() {
  const card = selectedCard();
  const mode = currentMode();
  const family = state.view.startsWith("tools:") ? state.view.split(":")[1] : null;
  if (family && !card) {
    const famLabel = { image: "images", document: "documents", video: "videos", audio: "audio files", archive: "archives", utilities: "files" }[family] || "files";
    els.stageTitle.textContent = "Nothing on the desk";
    els.stageSub.textContent = "Add a file to use these tools.";
    els.stageGrid.innerHTML = "";
    els.stageDots.innerHTML = "";
    els.stageEmpty.hidden = false;
    els.stageEmpty.innerHTML = `<div class="empty-art">${icon("tools", 40)}</div><b>No ${famLabel} yet</b><span>Drop ${famLabel === "audio files" ? "an audio file" : `a${famLabel.startsWith("i") || famLabel.startsWith("a") ? "n" : ""} ${famLabel.replace(/s$/, "")}`} here, or use Add Files.</span><button class="btn primary" data-action="add">Add files</button>`;
    els.pagePrev.disabled = true;
    els.pageNext.disabled = true;
    state.current = { card: null, targets: [], mode };
    updateModeUI();
    return;
  }
  const targets = targetsFor(mode, card);
  state.current = { card, targets, mode };
  const key = `${card?.id || "none"}|${mode}|${state.view}|${targets.map((t) => t.key).join(",")}`;
  if (key !== state.stageKey) {
    state.stageKey = key;
    state.stagePage = 0;
  }
  // Three columns at phone width hold nine tiles; the desktop grid is 4 × 2.
  const perPage = window.matchMedia("(max-width: 620px)").matches ? 9 : 8;
  const pages = Math.max(1, Math.ceil(targets.length / perPage));
  state.stagePage = clamp(state.stagePage, 0, pages - 1);
  const slice = targets.slice(state.stagePage * perPage, state.stagePage * perPage + perPage);

  const catLabel = categoryByKey(card?.category)?.label || "File";
  if (!card) {
    els.stageTitle.textContent = "Drop a file to begin";
    els.stageSub.textContent = "Shift formats · Ctrl tools · Alt actions";
  } else if (mode === "formats") {
    els.stageTitle.textContent = state.view === "batch" ? "Batch convert" : `Choose ${singularFor(catLabel)} format`;
    els.stageSub.textContent = state.view === "batch"
      ? `${cardsOfKind(card).length} ${singularFor(catLabel)} file${cardsOfKind(card).length === 1 ? "" : "s"} will follow this choice`
      : card.name;
  } else if (mode === "tools") {
    const kind = singularFor(catLabel);
    els.stageTitle.textContent = `${kind.charAt(0).toUpperCase()}${kind.slice(1)} tools`;
    els.stageSub.textContent = card.name;
  } else {
    els.stageTitle.textContent = "File actions";
    els.stageSub.textContent = card.name;
  }

  els.stageGrid.innerHTML = slice.map((t, i) => {
    const reason = whyUnsupported(t, card, selectionCards());
    const off = !!reason;
    const glyph = t.kind === "format"
      ? formatIcon(t.key, 42)
      : `<span class="tile-tool">${icon(t.icon || "tools", 22)}</span>`;
    return `<button class="tile${off ? " off" : ""}${t.kind !== "format" ? " tile-tool-card" : ""}" data-target="${t.key}" data-i="${state.stagePage * perPage + i}" title="${escapeHtml(reason || t.hint || t.label)}">
      ${glyph}
      <span class="tile-label">${escapeHtml(t.label)}</span>
      ${off ? `<span class="tile-lock">${icon("lock", 10)}</span>` : ""}
    </button>`;
  }).join("");

  els.stageEmpty.hidden = targets.length > 0 || !card;
  if (targets.length) {
    els.stageEmpty.hidden = true;
    els.stageEmpty.innerHTML = "";
  } else if (!card) {
    els.stageEmpty.hidden = false;
    els.stageEmpty.innerHTML = `<div class="empty-art">${icon("cursor", 42)}</div>
      <b>Point at a file</b>
      <span>Select a file on the left, or drop one anywhere on this page.</span>
      <button class="btn primary" data-action="add">Add files</button>`;
  } else {
    els.stageEmpty.hidden = false;
    const reason = readReason(card.name);
    els.stageEmpty.innerHTML = `<div class="empty-art">${formatIcon(card.ext, 44)}</div>
      <b>${reason ? "Not readable in this browser" : "Nothing here"}</b>
      <span>${escapeHtml(reason || "There is nothing in the catalogue for this file.")}</span>`;
  }

  els.pagePrev.disabled = state.stagePage <= 0;
  els.pageNext.disabled = state.stagePage >= pages - 1;
  els.pagePrev.hidden = pages <= 1;
  els.pageNext.hidden = pages <= 1;
  els.stageDots.innerHTML = pages > 1
    ? Array.from({ length: pages }, (_, i) => `<button class="dot${i === state.stagePage ? " on" : ""}" data-page="${i}" aria-label="Page ${i + 1}"></button>`).join("")
    : "";
  updateModeUI();
}

function renderInspector() {
  const card = selectedCard();
  if (!card) {
    els.inspector.innerHTML = `<div class="pane-head"><h2 class="pane-title">Selected file</h2><span class="kind-pill">—</span></div>
      <div class="ins-empty">
        <div class="ins-empty-icon">${icon("file", 34)}</div>
        <b>No file selected</b>
        <span>Add a file, or pick one on the left.</span>
      </div>`;
    return;
  }
  const cat = categoryByKey(card.category);
  const reason = readReason(card.name);
  const supported = formatsFor(card.name).filter((t) => !whyUnsupported(t, card, selectionCards()));
  let chosenKey = state.lastFormat[card.category] || "";
  let target = supported.find((t) => t.key === chosenKey);
  if (!target) target = supported.find((t) => t.key !== ownKey(card.name)) || supported[0] || null;
  chosenKey = target?.key || "";
  const fields = target ? fieldsFor(target, card) : {};
  const optionKey = Object.keys(fields).find((k) => fields[k].type === "range");
  const optionSpec = optionKey ? fields[optionKey] : null;
  const optionValue = optionKey
    ? (state.quality[target.key]?.[optionKey] ?? optionSpec.value)
    : null;
  const optionPct = optionSpec
    ? ((Number(optionValue) - optionSpec.min) / Math.max(1, optionSpec.max - optionSpec.min)) * 100
    : 0;

  const rows = [
    ["Kind", kindFor(card)],
    ["Size", formatBytes(card.size)],
  ];
  if (card.details?.dimensions) rows.push(["Dimensions", card.details.dimensions]);
  if (card.details?.pages) rows.push(["Pages", `${card.details.pages} page${card.details.pages === 1 ? "" : "s"}`]);
  if (card.details?.duration) rows.push(["Length", card.details.duration]);
  if (card.details?.meta && card.category === "archive") rows.push(["Contents", card.details.meta]);
  if (card.modified) rows.push(["Modified", dateText(card.modified)]);

  const preview = card.previewURL || card.thumbURL
    ? `<img src="${card.previewURL || card.thumbURL}" alt="">`
    : formatIcon(card.ext, 58);

  const outExt = target ? (target.key === "gzip" ? "gz" : target.key) : "";
  const outName = target ? nextDeskName(`${stem(card.name)}.${outExt}`) : "";

  els.inspector.innerHTML = `
    <div class="pane-head">
      <h2 class="pane-title">Selected file</h2>
      <span class="kind-pill">${escapeHtml((card.categoryLabel || "File").toUpperCase().slice(0, 12))}</span>
    </div>
    <div class="ins-body">
      <div class="ins-preview">${preview}</div>
      <div class="ins-name" title="${escapeHtml(card.name)}">${escapeHtml(card.name)}</div>
      <div class="ins-where" title="${escapeHtml(card.name)}">Downloads folder · this browser</div>
      <div class="ins-section">THIS FILE</div>
      ${rows.map(([k, v]) => `<div class="ins-row"><span class="ins-key">${escapeHtml(k)}</span><span class="ins-value" title="${escapeHtml(v)}">${escapeHtml(v)}</span></div>`).join("")}
      <div class="ins-section">OUTPUT</div>
      <div class="ins-row">
        <span class="ins-key">Format</span>
        <select id="format-select" class="ins-select" ${supported.length ? "" : "disabled"} aria-label="Output format">
          ${supported.map((t) => `<option value="${t.key}"${t.key === chosenKey ? " selected" : ""}>${escapeHtml(t.label)}</option>`).join("")}
        </select>
      </div>
      ${optionSpec ? `<div class="ins-row"><span class="ins-key">${escapeHtml(optionSpec.label)}</span><span class="ins-value" id="option-value">${optionValue}${optionSpec.unit || ""}</span></div>
        <input type="range" id="option-range" class="ins-range" min="${optionSpec.min}" max="${optionSpec.max}" step="${optionSpec.step}" value="${optionValue}" style="--val:${optionPct}%" aria-label="${escapeHtml(optionSpec.label)}">`
      : `<div class="ins-note">${reason ? escapeHtml(reason) : target ? `${escapeHtml(target.label)} is written as it is — there is nothing to choose.` : "Pick a file to see what it can become."}</div>`}
      <button class="ins-dest" id="dest-btn" title="Where the new file will be saved">
        ${icon("folder", 15)}
        <span id="dest-label">${state.dirHandle ? escapeHtml(state.dirHandle.name) : "Downloads folder"}</span>
        ${icon("chevronDown", 13)}
      </button>
    </div>
    <div class="ins-foot">
      <button class="btn convert" id="btn-convert" ${target ? "" : "disabled"}>${target ? `Convert to ${escapeHtml(target.label)}` : "Convert"}</button>
      <div class="ins-out" title="${escapeHtml(outName)}">${target ? `Saves as ${escapeHtml(outName)}` : ""}</div>
    </div>`;

  const select = $("#format-select");
  select?.addEventListener("change", (e) => {
    state.lastFormat[card.category] = e.target.value;
    store.set(SAVE_KEYS.formats, state.lastFormat);
    renderInspector();
  });
  $(".ins-range")?.addEventListener("input", (e) => {
    if (!target || !optionKey) return;
    const v = Number(e.target.value);
    state.quality[target.key] = { ...(state.quality[target.key] || {}), [optionKey]: v };
    store.set(SAVE_KEYS.quality, state.quality);
    const out = $("#option-value");
    if (out) out.textContent = `${v}${optionSpec.unit || ""}`;
    const pct = ((v - Number(optionSpec.min)) / Math.max(1, Number(optionSpec.max) - Number(optionSpec.min))) * 100;
    e.target.style.setProperty("--val", `${pct}%`);
  });
  $("#dest-btn")?.addEventListener("click", chooseDestination);
  $("#btn-convert")?.addEventListener("click", () => {
    if (!target) return;
    const opts = explicitOptions(target, card, optionKey, optionValue);
    handleTarget(card, target, "inspector", opts);
  });
}

function nextDeskName(name) {
  const taken = new Set(state.files.map((c) => c.name.toLowerCase()));
  return uniqueName(name, taken);
}

function explicitOptions(target, card, optionKey, optionValue) {
  const opts = defaultOptionsFor(target, card);
  if (optionKey) opts[optionKey] = Number(optionValue);
  return opts;
}

function renderQuickbar() {
  const card = selectedCard();
  const total = state.files.reduce((n, c) => n + c.size, 0);
  const supported = card ? formatsFor(card.name).filter((t) => !whyUnsupported(t, card, selectionCards())) : [];
  let chosen = supported.find((t) => t.key === state.lastFormat[card?.category]);
  if (!chosen) chosen = supported.find((t) => t.key !== ownKey(card?.name || "")) || supported[0];
  const sameKind = cardsOfKind(card);
  els.quickbar.innerHTML = `
    <div class="quick-summary">${state.files.length} file${state.files.length === 1 ? "" : "s"} · ${formatBytes(total)} on the desk</div>
    <div class="quick-actions">
      <button class="btn quick" data-action="downloads">${icon("download", 15)} Downloads</button>
      <button class="btn quick" data-action="batch" ${card ? "" : "disabled"}>${icon("batch", 15)} Batch convert</button>
      <button class="btn quick-primary" data-action="convert-all" ${chosen ? "" : "disabled"}>Convert all to ${chosen ? escapeHtml(chosen.label) : "…"}</button>
    </div>`;
}

function renderStatus() {
  const total = state.files.reduce((n, c) => n + c.size, 0);
  els.statusbar.innerHTML = `
    <div class="status-left">
      <span class="status-dot${state.busy ? " busy" : ""}"></span>
      <span class="status-ready">${escapeHtml(state.busy ? "Working…" : state.status)}</span>
      <span class="status-sep">·</span>
      <span>${state.files.length} file${state.files.length === 1 ? "" : "s"} loaded · ${formatBytes(total)}</span>
    </div>
    <div class="status-right">
      <span class="catalogue-note">${stats().paths} paths · ${stats().tools} tools</span>
      <span class="shortcut-label">Shortcuts:</span>
      <button class="shortcut" data-wheel="formats"><kbd>Shift</kbd> Formats</button>
      <button class="shortcut" data-wheel="tools"><kbd>Ctrl</kbd> Tools</button>
      <button class="shortcut" data-wheel="actions"><kbd>Alt</kbd> Actions</button>
      <span class="status-sep">·</span>
      <button class="shortcut" data-action="help"><kbd>F1</kbd> Help</button>
    </div>`;
}

function updateModeUI() {
  const mode = currentMode();
  $$(".pill").forEach((p) => {
    p.classList.toggle("active", p.dataset.wheel === mode);
    p.classList.toggle("pending", p.dataset.wheel === modifierPending && p.dataset.wheel !== mode);
  });
  $$(".statusbar .shortcut[data-wheel]").forEach((b) => {
    b.classList.toggle("active", b.dataset.wheel === mode);
    b.classList.toggle("pending", b.dataset.wheel === modifierPending && b.dataset.wheel !== mode);
  });
}

/* ------------------------------------------------------------- interactions */
function bindEvents() {
  $("#btn-add")?.addEventListener("click", () => els.fileInput.click());
  $("#btn-add-folder")?.addEventListener("click", () => els.folderInput.click());
  els.fileInput.addEventListener("change", (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  });
  els.folderInput.addEventListener("change", (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  });
  els.miniDrop.addEventListener("click", () => els.fileInput.click());

  $("#btn-clear")?.addEventListener("click", async () => {
    if (!state.files.length) return;
    const ok = await openConfirm("Clear the desk?", `Remove ${state.files.length} file${state.files.length === 1 ? "" : "s"} from this window? The originals on your computer are not touched.`, { applyLabel: "Clear desk" });
    if (!ok) return;
    for (const c of state.files) if (c.previewURL) URL.revokeObjectURL(c.previewURL);
    state.files = [];
    state.selectedId = null;
    state.multi.clear();
    state.downloads = [];
    renderAll();
    setStatus("Ready");
  });

  els.themeBtn?.addEventListener("click", () => applyTheme(state.theme === "dark" ? "light" : "dark"));
  $("#btn-help")?.addEventListener("click", openHelp);
  $("#btn-downloads")?.addEventListener("click", openDownloads);
  $("#btn-files-mobile")?.addEventListener("click", () => {
    els.app.classList.remove("show-inspector");
    els.app.classList.toggle("show-files");
  });
  $("#btn-inspector-mobile")?.addEventListener("click", () => {
    els.app.classList.remove("show-files");
    els.app.classList.toggle("show-inspector");
  });

  els.search.addEventListener("input", (e) => {
    state.search = e.target.value;
    renderFiles();
  });

  $("#view-list")?.addEventListener("click", () => setTiles(false));
  $("#view-grid")?.addEventListener("click", () => setTiles(true));

  $("#page-prev")?.addEventListener("click", () => turnPage(-1));
  $("#page-next")?.addEventListener("click", () => turnPage(1));

  document.addEventListener("click", onDocumentClick);
  document.addEventListener("dblclick", onDocumentDoubleClick);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearModifierWait);

  // drag and drop
  window.addEventListener("dragenter", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth += 1;
    els.dragOverlay.hidden = false;
  });
  window.addEventListener("dragover", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
  });
  window.addEventListener("dragleave", (e) => {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) els.dragOverlay.hidden = true;
  });
  window.addEventListener("drop", async (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    els.dragOverlay.hidden = true;
    const items = e.dataTransfer?.items;
    if (items && items.length && items[0].webkitGetAsEntry) {
      const files = [];
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) await walkEntry(entry, files);
      }
      if (files.length) addFiles(files);
      return;
    }
    addFiles(e.dataTransfer.files);
  });
  els.dragOverlay.addEventListener("click", () => { els.dragOverlay.hidden = true; });
}

function hasFiles(e) {
  return Array.from(e.dataTransfer?.types || []).includes("Files");
}

async function walkEntry(entry, out) {
  if (out.length >= 300) return;
  if (entry.isFile) {
    const file = await new Promise((resolve) => entry.file(resolve, () => resolve(null)));
    if (file) out.push(file);
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    const read = () => new Promise((resolve) => reader.readEntries(resolve, () => resolve([])));
    for (;;) {
      const batch = await read();
      if (!batch.length) break;
      for (const child of batch) await walkEntry(child, out);
    }
  }
}

function setTiles(tiles) {
  state.tiles = tiles;
  store.set(SAVE_KEYS.tiles, tiles);
  $("#view-list")?.classList.toggle("on", !tiles);
  $("#view-grid")?.classList.toggle("on", tiles);
  renderFiles();
}

function turnPage(delta) {
  const perPage = window.matchMedia("(max-width: 620px)").matches ? 9 : 8;
  const total = state.current.targets.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  state.stagePage = clamp(state.stagePage + delta, 0, pages - 1);
  renderStage();
}

function setView(view) {
  state.view = view;
  if (view.startsWith("tools:")) state.mode = "tools";
  else if (view === "format" || view === "batch") state.mode = "formats";
  else state.mode = "formats";
  state.stagePage = 0;
  const list = visibleFiles();
  if (!list.some((c) => c.id === state.selectedId)) {
    state.selectedId = list[0]?.id || null;
    state.multi = new Set(state.selectedId ? [state.selectedId] : []);
  }
  wheel?.hide();
  renderAll();
  if (window.innerWidth <= 900) els.app.classList.remove("show-files");
}

function syncWheelHint() {
  if (!wheel?.open) return;
  const hints = {
    formats: "Select a format to export",
    tools: "Work on a copy — the original stays untouched",
    actions: "Act on the selected file",
  };
  if (els.stageSub) els.stageSub.textContent = hints[state.mode] || "";
}

function openWheel(mode) {
  modifierPending = null;
  if (!selectedCard()) {
    updateModeUI();
    toast("Select a file first — the wheel acts on the file you are pointing at.", "error");
    return;
  }
  state.mode = mode;
  updateModeUI();
  renderStage();
  wheel.show(mode);
  syncWheelHint();
}

/* --------------------------------------------------------------- document */
function onDocumentClick(e) {
  const wheelBtn = e.target.closest("[data-wheel]");
  if (wheelBtn) {
    e.preventDefault();
    const mode = wheelBtn.dataset.wheel;
    if (wheel.open && wheel.mode === mode) wheel.hide();
    else openWheel(mode);
    return;
  }
  const nav = e.target.closest("[data-view]");
  if (nav) {
    setView(nav.dataset.view);
    return;
  }
  const page = e.target.closest("[data-page]");
  if (page) {
    state.stagePage = Number(page.dataset.page);
    renderStage();
    return;
  }
  const check = e.target.closest("[data-check]");
  if (check) {
    e.stopPropagation();
    selectCard(check.dataset.check, { additive: true, keepView: true });
    return;
  }
  const row = e.target.closest("[data-id]");
  if (row && !e.target.closest("button")) {
    selectCard(row.dataset.id, { additive: e.ctrlKey || e.metaKey });
    return;
  }
  const tile = e.target.closest("[data-target]");
  if (tile) {
    const i = Number(tile.dataset.i);
    const target = state.current.targets[i];
    const card = state.current.card;
    if (!target || !card) return;
    const reason = whyUnsupported(target, card, selectionCards());
    if (reason) { toast(reason, "error"); return; }
    handleTarget(card, target, "stage");
    return;
  }
  const act = e.target.closest("[data-action]");
  if (act) {
    const a = act.dataset.action;
    if (a === "add") els.fileInput.click();
    else if (a === "help") openHelp();
    else if (a === "downloads") openDownloads();
    else if (a === "batch") openBatch();
    else if (a === "convert-all") convertAll();
    else if (a === "again") redownload(act.dataset.id);
    return;
  }
}

function onDocumentDoubleClick(e) {
  const row = e.target.closest("[data-id]");
  if (row && !e.target.closest("button")) {
    selectCard(row.dataset.id);
    openWheel("formats");
  }
}

function clearModifierWait() {
  if (modifierTimer) {
    clearTimeout(modifierTimer);
    modifierTimer = null;
  }
  if (modifierPending) {
    modifierPending = null;
    updateModeUI();
  }
}

function onKeyUp(e) {
  if (!["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
  // Only clear once every modifier is up; releasing one while another is still
  // held must not cancel the pending wheel of the held key.
  if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) clearModifierWait();
}

function onKeyDown(e) {
  const typing = isTyping(e.target);
  const mod = e.key === "Shift" || e.key === "Control" || e.key === "Alt";
  if (mod && !typing) {
    if (e.repeat) return;
    const mode = e.key === "Shift" ? "formats" : e.key === "Control" ? "tools" : "actions";
    clearTimeout(modifierTimer);
    modifierTimer = null;
    if (wheel.open) {
      e.preventDefault();
      modifierPending = null;
      state.mode = mode;
      updateModeUI();
      renderStage();
      wheel.setMode(mode);
      return;
    }
    // Show the keycap state immediately, before the hold delay opens the ring.
    modifierPending = mode;
    updateModeUI();
    modifierTimer = setTimeout(() => {
      modifierTimer = null;
      const canOpen = !state.busy && selectedCard();
      modifierPending = null;
      if (canOpen) openWheel(mode);
      else updateModeUI();
    }, 160);
    return;
  }
  if (modifierTimer || modifierPending) clearModifierWait();

  if (typing) return;
  if (e.key === "F1" || (e.key === "?" && !e.metaKey)) {
    e.preventDefault();
    openHelp();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    els.search.focus();
    els.search.select();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && !wheel.open) {
    e.preventDefault();
    state.multi = new Set(visibleFiles().map((c) => c.id));
    if (!state.selectedId && state.files[0]) state.selectedId = state.files[0].id;
    renderAll();
  } else if (e.key === "Escape") {
    wheel.hide();
    els.app.classList.remove("show-files", "show-inspector");
    els.dragOverlay.hidden = true;
  } else if ((e.key === "Delete" || e.key === "Backspace") && state.selectedId && !wheel.open) {
    e.preventDefault();
    removeCard(state.selectedId);
  }
}

function isTyping(target) {
  return target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
}

/* ------------------------------------------------------------- conversions */
function quickOptions(target, card) {
  const opts = defaultOptionsFor(target, card);
  const saved = state.quality[target.key];
  const fields = fieldsFor(target, card);
  if (saved) {
    for (const key of Object.keys(fields)) {
      if (saved[key] != null) opts[key] = saved[key];
    }
  }
  return opts;
}

async function handleTarget(card, target, origin, explicit = null) {
  if (!card || state.busy) return;
  const reason = whyUnsupported(target, card, selectionCards());
  if (reason) { toast(reason, "error"); return; }
  if (target.kind === "action") { performAction(card, target); return; }
  if (state.view === "batch" && target.kind === "format") {
    const opts = explicit || quickOptions(target, card);
    await convertMany(cardsOfKind(card), target, opts);
    return;
  }
  let opts = explicit;
  if (!opts) {
    const fields = fieldsFor(target, card);
    if (Object.keys(fields).length) {
      opts = await openTool(card, target, fields);
      if (!opts) return;
    } else {
      opts = quickOptions(target, card);
    }
  }
  // Merge reads ctx.selection itself.  Running it once per selected card would
  // write the same merged output over and over.
  await convertMany([card], target, opts);
}

async function openTool(card, target, fields) {
  const values = defaultOptionsFor(target, card);
  let preview = null;
  if (target.key === "crop_image" && card.previewURL) {
    preview = {
      html: `<div class="crop-wrap"><img src="${card.previewURL}" alt=""><div class="crop-box" id="crop-box"></div></div>`,
      update(v, root) {
        const box = root.querySelector("#crop-box");
        if (!box) return;
        box.style.left = `${v.left}%`;
        box.style.top = `${v.top}%`;
        box.style.width = `${Math.max(1, 100 - v.left - v.right)}%`;
        box.style.height = `${Math.max(1, 100 - v.top - v.bottom)}%`;
      },
      init(root) {
        const box = root.querySelector("#crop-box");
        if (box) { box.style.left = "8%"; box.style.top = "8%"; box.style.width = "84%"; box.style.height = "84%"; }
      },
    };
  }
  let note = "";
  if (target.key === "merge") {
    const sel = selectionCards();
    note = sel.length > 1
      ? `Will merge ${sel.length} files: ${sel.map((c) => escapeHtml(c.name)).join(", ")}`
      : "Select more files on the desk with the check circles to merge them.";
  } else if (target.key === "trim") {
    note = `Length: ${card.details?.duration || "unknown"}. Leave End at 0 to keep the rest.`;
  } else if (target.key === "split") {
    note = card.category === "pdf" ? "" : "Equal pieces; the last piece may be shorter.";
  } else if (target.key === "compress_pdf") {
    note = "A lossless clean re-save with metadata removed and object streams enabled. The browser cannot downsample PDF images the way Ghostscript does, so savings are modest.";
  } else if (target.key === "snapshot") {
    note = `Length: ${card.details?.duration || "unknown"}.`;
  } else if (target.key === "resize_image") {
    note = `Original: ${card.details?.dimensions || "unknown"}. Set one side and the other follows.`;
  }
  const valuesOut = await openFields({
    title: target.label,
    subtitle: target.hint || "",
    fields,
    values,
    applyLabel: "Apply",
    preview,
    note,
    wide: target.key === "split" && card.category === "pdf",
  });
  return valuesOut;
}

async function convertMany(cards, target, opts) {
  const list = cards.filter(Boolean);
  if (!list.length) return;
  if (state.busy) { toast("One conversion at a time — the desk is already working.", "error"); return; }
  state.busy = true;
  state.cancelRequested = false;
  setStatus("Converting…");
  renderStatus();
  showProgress(target.verb || `Making ${target.label}`, list[0].name);
  const started = Date.now();
  const results = [];
  const errors = [];
  let uploaded = 0;
  const ctx = {
    name: "",
    progress(p) {
      const ratio = (uploaded + clamp(Number(p) || 0, 0, 1)) / list.length;
      updateProgress(ratio, list[Math.min(uploaded, list.length - 1)]?.name || "");
    },
    isCancelled: () => state.cancelRequested,
    selection: selectionCards(),
    engineReady: () => updateProgressDetail("Media engine ready"),
    ingest: (files, message) => {
      const added = addFiles(files, { select: false, quiet: true });
      if (added.length) {
        toast(message || `${added.length} file${added.length === 1 ? "" : "s"} added to the desk`, "success");
        renderAll();
      }
    },
    log: () => {},
  };
  try {
    for (let i = 0; i < list.length; i += 1) {
      uploaded = i;
      if (state.cancelRequested) throw new DOMException("Cancelled", "AbortError");
      updateProgress(i / list.length, list[i].name);
      try {
        ctx.name = list[i].name;
        const r = await runConversion(list[i], target, opts, ctx);
        results.push(...(r || []));
      } catch (err) {
        if (err?.name === "AbortError") throw err;
        errors.push({ name: list[i].name, message: err?.message || String(err) });
      }
      updateProgress((i + 1) / list.length, list[i].name);
    }
    if (state.cancelRequested) throw new DOMException("Cancelled", "AbortError");
    if (results.length) {
      const base = list.length > 1 ? `${stem(list[0].name)} batch` : stem(list[0].name);
      await saveResults(results, base);
      if (target.kind === "format") {
        state.lastFormat[list[0].category] = target.key;
        store.set(SAVE_KEYS.formats, state.lastFormat);
      }
    } else if (!errors.length) {
      toast("Done");
    }
    if (errors.length) {
      const first = errors[0];
      toast(`${errors.length} file${errors.length === 1 ? "" : "s"} failed: ${first.name} — ${first.message}`, "error", 7000);
    }
  } catch (err) {
    if (err?.name === "AbortError") toast("Cancelled");
    else toast(err?.message || "The conversion failed.", "error", 7000);
  } finally {
    const cancelled = state.cancelRequested;
    state.busy = false;
    state.cancelRequested = false;
    hideProgress(started);
    // An abort can make ffmpeg throw before the loop notices the flag.  That
    // is a cancelled job, not a failed one.
    setStatus(cancelled ? "Ready" : errors.length ? `${errors.length} failed` : "Ready");
    renderAll();
  }
}

async function saveResults(results, base) {
  const list = results.filter(Boolean);
  if (!list.length) return;
  const taken = new Set(state.files.map((c) => c.name.toLowerCase()));
  for (const r of list) r.name = uniqueName(r.name, taken);
  if (list.length === 1) {
    await saveBlob(list[0].blob, list[0].name);
    toast(`Saved ${list[0].name}`, "success");
    return;
  }
  const zip = await makeZip(list);
  const name = `${safeName(base)}.zip`;
  await saveBlob(zip, name);
  toast(`Saved ${list.length} files as ${name}`, "success");
}

async function saveBlob(blob, name) {
  if (state.dirHandle) {
    try {
      await writeToDirectory(state.dirHandle, blob, name);
      recordDownload(name, blob);
      return;
    } catch {
      toast("The output folder could not be written; using Downloads instead.", "error");
    }
  }
  await download(blob, name);
  recordDownload(name, blob);
}

function recordDownload(name, blob) {
  state.downloads.unshift({ id: uid("d"), name, blob, size: blob.size, at: Date.now() });
  if (state.downloads.length > 24) state.downloads.length = 24;
}

async function convertAll() {
  const card = selectedCard();
  if (!card) return;
  const supported = formatsFor(card.name).filter((t) => !whyUnsupported(t, card, selectionCards()));
  const target = supported.find((t) => t.key === state.lastFormat[card.category])
    || supported.find((t) => t.key !== ownKey(card.name)) || supported[0];
  if (!target) { toast("There is nothing to convert this file into.", "error"); return; }
  await convertMany(cardsOfKind(card), target, quickOptions(target, card));
}

async function openBatch() {
  const card = selectedCard();
  if (!card) { toast("Select a file first.", "error"); return; }
  const supported = formatsFor(card.name).filter((t) => !whyUnsupported(t, card, selectionCards()));
  if (!supported.length) { toast("There is nothing to convert this kind of file into.", "error"); return; }
  const cards = cardsOfKind(card);
  const fields = {
    format: {
      label: "Convert to", type: "select", value: supported[0].key,
      options: supported.map((t) => [t.key, t.label]),
    },
    quality: { label: "Quality", type: "range", min: 20, max: 95, step: 1, value: 90 },
  };
  const values = await openFields({
    title: "Batch convert",
    subtitle: `${cards.length} ${singularFor(categoryByKey(card.category)?.label || "File")} file${cards.length === 1 ? "" : "s"} on the desk`,
    fields,
    values: { format: supported[0].key, quality: 90 },
    applyLabel: `Convert ${cards.length}`,
    note: "Every file of this kind is converted with the same settings.",
  });
  if (!values) return;
  const target = supported.find((t) => t.key === values.format);
  if (!target) return;
  const opts = quickOptions(target, card);
  if ("quality" in fieldsFor(target, card)) opts.quality = values.quality;
  await convertMany(cards, target, opts);
}

/* ------------------------------------------------------------------ actions */
async function performAction(card, target) {
  switch (target.key) {
    case "download":
      await saveBlob(card.blob, card.name);
      toast(`Saved ${card.name}`, "success");
      break;
    case "copy": {
      try {
        if (navigator.clipboard?.write && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ [card.blob.type || "application/octet-stream"]: card.blob })]);
          toast("File copied to the clipboard", "success");
        } else throw new Error("no clipboard files");
      } catch {
        await copyText(card.name);
        toast("The browser cannot copy this file; the name was copied instead.", "error");
      }
      break;
    }
    case "copy_name":
      await copyText(card.name);
      break;
    case "duplicate": {
      const taken = new Set(state.files.map((c) => c.name.toLowerCase()));
      const [s, x] = [stem(card.name), card.ext];
      const name = uniqueName(x ? `${s} copy.${x}` : `${s} copy`, taken);
      const f = new File([card.blob], name, { type: card.blob.type, lastModified: Date.now() });
      addFiles([f], { quiet: false });
      break;
    }
    case "rename": {
      const values = await openFields({
        title: "Rename",
        subtitle: "The file stays on the desk; only its name changes.",
        fields: { name: { label: "Name", type: "text", value: card.name } },
        values: { name: card.name },
        applyLabel: "Rename",
        allowReset: false,
      });
      if (!values?.name?.trim()) return;
      const newName = safeName(values.name.trim());
      const f = new File([card.blob], newName, { type: card.blob.type, lastModified: card.modified });
      card.file = f;
      card.blob = f;
      card.name = newName;
      card.ext = extension(newName);
      const cat = categoryFor(newName);
      card.category = cat?.key || "other";
      card.categoryLabel = cat?.label || "File";
      card.details = { ...card.details, kind: kindFor(card) };
      card.thumbURL = null;
      card.detailLoaded = false;
      probeCard(card);
      renderAll();
      toast("Renamed", "success");
      break;
    }
    case "favorite": {
      const key = favKey(card);
      if (state.favorites.has(key)) { state.favorites.delete(key); toast("Removed from Favorites"); }
      else { state.favorites.add(key); toast("Added to Favorites", "success"); }
      store.set(SAVE_KEYS.favorites, [...state.favorites]);
      renderAll();
      break;
    }
    case "info": {
      const rows = [
        ["Name", card.name], ["Kind", kindFor(card)], ["Size", formatBytes(card.size)],
        ["Type", card.blob.type || "unknown"], ["Category", card.categoryLabel],
        ["Dimensions", card.details?.dimensions || "—"],
        ["Pages", card.details?.pages ? String(card.details.pages) : "—"],
        ["Length", card.details?.duration || "—"],
        ["Modified", dateText(card.modified)],
        ["Readable here", readReason(card.name) || "Yes"],
      ];
      openText("File info", `<table class="info-table">${rows.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join("")}</table>`);
      break;
    }
    case "remove":
      removeCard(card.id);
      break;
    case "select_all":
      state.multi = new Set(visibleFiles().map((c) => c.id));
      if (!state.selectedId && state.files[0]) state.selectedId = state.files[0].id;
      renderAll();
      break;
    default:
      toast("That action is not available in the web app.", "error");
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied", "success");
  } catch {
    toast("The clipboard is not available in this browser.", "error");
  }
}

/* ------------------------------------------------------------------ dialogs */
function openHelp() {
  const s = stats();
  const body = `
    <p class="sheet-text">A2Z Convertor Web is the desktop app's desk, rebuilt for the browser. Files are decoded and re-encoded <b>in this tab</b> — nothing is uploaded, and there is no account or telemetry. The only requests are this site's own files, including ffmpeg.wasm when you first convert audio or video.</p>
    <h3 class="sheet-h">Three ways in</h3>
    <div class="help-grid">
      <div><kbd>Shift</kbd><b>Formats</b><span>Convert to another file type</span></div>
      <div><kbd>Ctrl</kbd><b>Tools</b><span>Crop, trim, compress, merge…</span></div>
      <div><kbd>Alt</kbd><b>Actions</b><span>Download, copy, rename, info</span></div>
    </div>
    <h3 class="sheet-h">Keys</h3>
    <table class="info-table">
      <tr><th>Hold Shift / Ctrl / Alt</th><td>Open the wheel over the selected file</td></tr>
      <tr><th>Arrow keys</th><td>Move around the wheel; Enter applies</td></tr>
      <tr><th>+ / − / 0</th><td>Grow, shrink, reset the wheel</td></tr>
      <tr><th>Esc</th><td>Close the wheel or a dialog</td></tr>
      <tr><th>Ctrl K</th><td>Search the files on the desk</td></tr>
      <tr><th>Ctrl A</th><td>Select every file</td></tr>
      <tr><th>F1</th><td>This help</td></tr>
    </table>
    <h3 class="sheet-h">What works here</h3>
    <p class="sheet-text">Images (PNG, JPG, WebP, GIF, BMP, ICO, TIFF, PDF), PDFs (text, images, PPTX, EPUB, split/merge/rotate), audio and video (ffmpeg.wasm is fetched on first media conversion), documents (DOCX, ODT, RTF, MD, TXT, HTML, EPUB), slides (PPTX/ODP text), spreadsheets (XLSX/XLS/ODS/CSV/TSV), subtitles and archives (ZIP/TAR/GZIP).</p>
    <p class="sheet-text">A few desktop paths need a real office suite or a codec the browser does not ship (HEIC encoding, RAR/7z reading, legacy DOC/PPT). They stay visible, greyed, and say why — they never fail silently.</p>
    <p class="sheet-note">${s.paths} conversion paths · ${s.tools} tools · ${s.actions} actions · ${s.categories} families. Built as a separate web app; the desktop build is unchanged.</p>`;
  openText("A2Z Convertor Web", body, { width: "620px", cls: "help-sheet" });
}

function openDownloads() {
  const rows = state.downloads.map((d) => `<div class="dl-row">
    <span class="dl-ico">${icon("download", 18)}</span>
    <div class="dl-text"><b>${escapeHtml(d.name)}</b><span>${formatBytes(d.size)} · ${dateText(d.at)}</span></div>
    <button class="btn ghost" data-action="again" data-id="${d.id}">Save again</button>
  </div>`).join("");
  openText("Downloads from this session", rows
    ? `<div id="download-list">${rows}</div><p class="sheet-note">Results are kept in this tab for the session. Your browser also keeps its own download history.</p>`
    : `<p class="sheet-text">Nothing has been converted yet. Finished files appear here so you can save them again.</p>`,
  { width: "520px" });
}

function redownload(id) {
  const d = state.downloads.find((x) => x.id === id);
  if (d) saveBlob(d.blob, d.name);
}

async function chooseDestination() {
  if (!window.showDirectoryPicker) {
    toast("This browser always saves to its Downloads folder. Folder picking needs Chrome or Edge.", "error", 6000);
    return;
  }
  try {
    state.dirHandle = await window.showDirectoryPicker({ id: "a2z-output", mode: "readwrite" });
    renderInspector();
    toast(`New files will be saved in ${state.dirHandle.name}`, "success");
  } catch (e) {
    if (e?.name !== "AbortError") toast("That folder could not be opened.", "error");
  }
}

/* ------------------------------------------------------------------ progress */
function showProgress(title, file) {
  showProgress.started = Date.now();
  $("#progress-slot").innerHTML = `<div class="progress-card">
    <div class="progress-head">
      <span class="spinner"></span>
      <div class="progress-text"><b>${escapeHtml(title)}</b><span>${escapeHtml(file || "")}</span></div>
      <button class="icon-btn" id="cancel-work" title="Cancel">${icon("close", 14)}</button>
    </div>
    <div class="bar"><i id="progress-bar"></i></div>
    <div class="progress-foot"><span id="progress-detail">Starting…</span><span id="progress-elapsed">0.0s</span></div>
  </div>`;
  $("#cancel-work")?.addEventListener("click", async () => {
    state.cancelRequested = true;
    updateProgressDetail("Cancelling…");
    const { abortMedia } = await import("./convert/media.js");
    await abortMedia();
  });
  updateProgress(0.02, file);
}

function updateProgress(ratio, file) {
  const bar = $("#progress-bar");
  if (bar) bar.style.width = `${clamp(ratio, 0, 1) * 100}%`;
  if (file) {
    const el = $(".progress-text span");
    if (el) el.textContent = file;
  }
  const elapsed = $("#progress-elapsed");
  if (elapsed && showProgress.started) elapsed.textContent = `${((Date.now() - showProgress.started) / 1000).toFixed(1)}s`;
}

function updateProgressDetail(text) {
  const el = $("#progress-detail");
  if (el) el.textContent = text;
}

function hideProgress(started) {
  const card = $(".progress-card");
  if (!card) return;
  card.classList.add("done");
  setTimeout(() => { $("#progress-slot").innerHTML = ""; }, 220);
  showProgress.started = 0;
}

/* ------------------------------------------------------------------- toasts */
function toast(message, type = "info", ms = 4200) {
  const root = $("#toast-root");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-ico">${icon(type === "error" ? "info" : type === "success" ? "check" : "spark", 15)}</span><span>${escapeHtml(message)}</span>`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add("in"));
  const kill = () => {
    el.classList.remove("in");
    setTimeout(() => el.remove(), 180);
  };
  el.addEventListener("click", kill);
  setTimeout(kill, ms);
}

function setStatus(text) {
  state.status = text;
  renderStatus();
}

/* -------------------------------------------------------------------- start */
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
