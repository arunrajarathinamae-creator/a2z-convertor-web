# A2Z Convertor Web

The A2Z Convertor desk, rebuilt as a standalone static website for GitHub Pages.
It keeps the desktop app's rail, files pane, stage tiles, selected-file
inspector, radial wheel and light/dark themes — but every conversion runs inside
the browser tab.

**Live site:** https://arunrajarathinamae-creator.github.io/a2z-convertor-web/

**No server, no account, no uploads, no telemetry.** Files are read with the
File API, decoded by canvas/WebAssembly, and saved through the browser's normal
download flow.

The desktop application is a separate project; this repository contains only
the browser build.

## Run it locally

ES modules do not load over `file://`, so use any static file server:

```bash
# from this folder
python3 -m http.server 8080
# open http://localhost:8080
```

Chrome or Edge is recommended (file-system output folder and the full media
engine). Firefox and Safari work for most conversions, with the browser's own
Downloads folder as the destination.

## Deploy to GitHub Pages

The repository root is the site. Pages is configured to deploy from the `main`
branch and the `/` folder.

1. Push to `main`.
2. Keep `.nojekyll` at the root.
3. Wait for the Pages build, then open the live URL above.

All asset URLs are relative, so the site also works from a project subpath.

## What is included

| Family | Read | Write / tools |
| --- | --- | --- |
| Images | JPG, PNG, WebP, GIF, BMP, SVG, TIFF, ICO, AVIF | PNG, JPG, WebP, TIFF, AVIF, BMP, ICO, GIF, PDF; compress, crop, rotate, resize, watermark, strip metadata, merge |
| Video | MP4, MOV, MKV, WebM, AVI | MP4, MOV, MKV, WebM, GIF, MP3, M4A, WAV; trim, crop, compress, split, merge, rotate, speed, snapshot, mute, strip metadata |
| Audio | MP3, M4A, WAV, FLAC, OGG, Opus, AIFF | MP3, M4A, WAV, FLAC, OGG, Opus, AIFF; trim, compress, split, merge, speed, normalise, strip metadata |
| PDF | PDF | TXT, MD, JPG, PNG, PPTX, EPUB; split, merge, compress, rotate, strip metadata |
| Documents | DOCX, ODT, RTF, Markdown, TXT, HTML, EPUB | PDF, DOCX, ODT, MD, TXT, HTML, EPUB, RTF |
| Slides | PPTX, ODP | PDF, JPG, PNG, PPTX, ODP (text-preserving reconstruction) |
| Spreadsheets | XLSX, XLS, ODS, CSV, TSV | XLSX, ODS, CSV, TSV, PDF, HTML |
| Subtitles | SRT, VTT | SRT, VTT, TXT; shift timestamps |
| Archives | ZIP, TAR, GZIP | ZIP, TAR, GZIP; extract into the desk, recompress |

Paths the browser genuinely cannot take remain visible in the catalogue, greyed,
with a plain explanation — HEIC/HEIF input, RAR/7z/BZip2/XZ input, legacy
`.doc`/`.ppt`, Apple Pages/Keynote/Numbers, and AVIF/HEIC output where the
browser has no encoder.

## How it is built

No build step. Plain HTML, CSS and ES modules under `assets/js/`.

```
index.html
assets/
  css/app.css
  icon.svg
  js/
    app.js           shell, state, event handling, downloads
    catalog.js       families, formats, tools, options, support rules
    util.js          blobs, names, ZIP, delivery
    loaders.js       lazy vendor/ffmpeg loaders
    convert/         one module per family + dispatcher
    ui/              icons, dialogs, wheel
  vendor/            pinned third-party libraries
```

Third-party code is vendored and loaded from this site only:

- pdf-lib, pdf.js, JSZip, fflate, SheetJS, mammoth.js, marked, Turndown,
  UTIF.js + pako, gifenc, PptxGenJS, jsPDF + jsPDF-AutoTable, html2canvas
- ffmpeg.wasm (`@ffmpeg/ffmpeg` 0.12 and the single-threaded core) — about 31 MB,
  fetched lazily on the first audio/video conversion

Please keep each library's upstream licence when redistributing this folder.

## Keyboard

- Hold **Shift** for formats, **Ctrl** for tools, **Alt** for actions.
- Arrow keys walk the wheel, **Enter** applies, **+ / − / 0** resize/reset it.
- **Esc** closes the wheel or a dialog.
- **Ctrl K** focuses search, **Ctrl A** selects every file, **F1** opens help.

Ctrl is also a browser modifier, so the wheel opens after a short hold and
cancels if another key is pressed.

## Notes and limits

- Results are saved through the browser. Where the File System Access API exists
  (Chrome/Edge), the inspector's destination button can choose an output folder;
  otherwise the browser's Downloads folder is used. Multi-file results are
  delivered as a ZIP.
- Video/audio conversions share one WebAssembly engine; only one runs at a time.
  A cancelled run discards the engine so the next run starts clean.
- Reconstructed PPTX/ODP/EPUB files preserve text and basic structure, not every
  font, animation or pixel of the original layout. The PDF path is the
  high-fidelity one.
- PDF text extraction depends on the PDF carrying a text layer; scanned pages
  become images, not OCR.
- PDF compression is a lossless clean re-save (metadata removed, object streams
  enabled). The browser cannot run Ghostscript or downsample embedded PDF
  images, so the reduction is often small.
- Large media files are limited by tab memory. The desk caps at 300 files and
  media work is best under a few hundred megabytes per file.

## Licence

MIT for the application code. Vendored libraries retain their own licences.
