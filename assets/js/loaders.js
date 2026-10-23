/* Lazy loaders for the heavy, well-tested libraries.
 *
 * The first paint ships none of them: the desk opens instantly, and a library
 * is fetched the first time a conversion actually needs it.  GitHub Pages
 * serves them from the same folder, so the app still makes no third-party
 * requests and works offline once cached.
 */

const VENDOR = new URL("../vendor/", import.meta.url);

const cache = new Map();

function script(key, file, check) {
  if (cache.has(key)) return cache.get(key);
  const p = new Promise((resolve, reject) => {
    if (check && check()) { resolve(check()); return; }
    const s = document.createElement("script");
    s.src = new URL(file, VENDOR).href;
    s.async = true;
    s.onload = () => {
      try { resolve(check ? check() : true); }
      catch (err) { reject(err); }
    };
    s.onerror = () => reject(new Error(`Could not load ${file}. Check that assets/vendor is present.`));
    document.head.appendChild(s);
  });
  cache.set(key, p);
  return p;
}

export function loadJSZip() {
  return script("jszip", "jszip.min.js", () => window.JSZip);
}

export function loadPdfLib() {
  return script("pdf-lib", "pdf-lib.min.js", () => window.PDFLib);
}

export async function loadPdfJs() {
  const lib = await script("pdfjs", "pdf.min.js", () => window.pdfjsLib);
  if (lib?.GlobalWorkerOptions) {
    lib.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.js", VENDOR).href;
  }
  return lib;
}

export function loadFflate() {
  return script("fflate", "fflate.umd.js", () => window.fflate);
}

export function loadXlsx() {
  return script("xlsx", "xlsx.full.min.js", () => window.XLSX);
}

export function loadMammoth() {
  return script("mammoth", "mammoth.browser.min.js", () => window.mammoth);
}

export async function loadMarked() {
  const m = await script("marked", "marked.min.js", () => window.marked);
  return m?.parse ? m : { parse: m };
}

export function loadTurndown() {
  return script("turndown", "turndown.js", () => window.TurndownService);
}

export async function loadUtif() {
  await script("pako", "pako.min.js", () => window.pako);
  return script("utif", "utif.js", () => window.UTIF);
}

export async function loadGifenc() {
  if (cache.has("gifenc")) return cache.get("gifenc");
  const p = (async () => {
    const url = new URL("gifenc.js", VENDOR).href;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Could not load the GIF encoder.");
    const code = await res.text();
    const exportsObj = {};
    // The package ships a CommonJS bundle; run it with its own exports object
    // instead of leaking a global `exports` into the page.
    // eslint-disable-next-line no-new-func
    new Function("exports", `${code}\nreturn exports;`)(exportsObj);
    window.GIFENC = exportsObj;
    return exportsObj;
  })();
  cache.set("gifenc", p);
  return p;
}

export function loadPptxGen() {
  return script("pptxgen", "pptxgen.bundle.js", () => window.PptxGenJS);
}

export async function loadJsPdf(autoTable = false) {
  await script("jspdf", "jspdf.umd.min.js", () => window.jspdf?.jsPDF);
  // AutoTable is a plugin, not a global of its own.  Passing a check here would
  // be wrong: the check runs before the script is inserted, so `() => true`
  // would resolve without ever loading the plugin.
  if (autoTable) await script("autotable", "jspdf.autotable.min.js");
  return window.jspdf.jsPDF;
}

export function loadHtml2Canvas() {
  return script("html2canvas", "html2canvas.min.js", () => window.html2canvas);
}

/* ------------------------------------------------------------------ ffmpeg */
let ffmpegPromise = null;

export function ffmpegSupported() {
  return typeof WebAssembly === "object" && typeof Worker !== "undefined";
}

export async function loadFFmpeg(onProgress, onLog) {
  if (ffmpegPromise) {
    const ff = await ffmpegPromise;
    if (onProgress) ff._a2zProgress = onProgress;
    if (onLog) ff._a2zLog = onLog;
    return ff;
  }
  ffmpegPromise = (async () => {
    if (!ffmpegSupported()) {
      throw new Error("This browser cannot run the media engine (WebAssembly or Worker support is missing).");
    }
    await script("ffmpeg-wrapper", "ffmpeg/ffmpeg.js", () => window.FFmpegWASM?.FFmpeg);
    const { FFmpeg } = window.FFmpegWASM;
    const ff = new FFmpeg();
    ff._a2zProgress = onProgress;
    ff._a2zLog = onLog;
    ff.on("progress", (p) => {
      const fn = ff._a2zProgress;
      if (fn) fn(Math.max(0, Math.min(1, Number(p.progress) || 0)));
    });
    ff.on("log", ({ message }) => {
      const fn = ff._a2zLog;
      if (fn && message) fn(message);
    });
    const base = new URL("ffmpeg/", VENDOR);
    await ff.load({
      coreURL: new URL("ffmpeg-core.js", base).href,
      wasmURL: new URL("ffmpeg-core.wasm", base).href,
    });
    return ff;
  })();
  try {
    return await ffmpegPromise;
  } catch (err) {
    ffmpegPromise = null;
    throw err;
  }
}

export async function resetFFmpeg() {
  if (!ffmpegPromise) return;
  try {
    const ff = await ffmpegPromise;
    ff.terminate();
  } catch { /* nothing to reset */ }
  ffmpegPromise = null;
}
