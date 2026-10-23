/* Audio and video: the browser's media element for previews, ffmpeg.wasm for
 * the actual transcoding.  The 31 MB engine is fetched once, on demand, from
 * this same site — never from a third party.
 */

import { extension, mimeFor, stem } from "../catalog.js";
import { durationText, formatBytes, safeName } from "../util.js";
import { loadFFmpeg, resetFFmpeg } from "../loaders.js";

const infoCache = new WeakMap();
const thumbCache = new WeakMap();

const VIDEO_EXT = new Set(["mp4", "mov", "mkv", "webm", "avi", "wmv", "m4v", "flv", "mpg", "mpeg"]);
const AUDIO_EXT = new Set(["mp3", "m4a", "wav", "flac", "ogg", "oga", "opus", "aiff", "aif", "wma"]);

export function isVideo(name) {
  return VIDEO_EXT.has(extension(name));
}

export function isAudio(name) {
  return AUDIO_EXT.has(extension(name));
}

function mediaElement(blob, video) {
  return new Promise((resolve, reject) => {
    const el = document.createElement(video ? "video" : "audio");
    const url = URL.createObjectURL(blob);
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      if (ok) resolve({ el, url });
      else { URL.revokeObjectURL(url); reject(new Error("unsupported")); }
    };
    el.preload = "metadata";
    el.muted = true;
    el.playsInline = true;
    el.onloadedmetadata = () => finish(true);
    el.onerror = () => finish(false);
    el.src = url;
    setTimeout(() => finish(false), 7000);
  });
}

export async function mediaInfo(card) {
  if (infoCache.has(card.blob)) return infoCache.get(card.blob);
  const p = (async () => {
    const video = isVideo(card.name);
    try {
      const { el, url } = await mediaElement(card.blob, video);
      const out = {
        duration: Number.isFinite(el.duration) ? el.duration : 0,
        width: el.videoWidth || 0,
        height: el.videoHeight || 0,
      };
      URL.revokeObjectURL(url);
      return out;
    } catch {
      return { duration: 0, width: 0, height: 0 };
    }
  })();
  infoCache.set(card.blob, p);
  return p;
}

export async function mediaThumb(card) {
  if (thumbCache.has(card.blob)) return thumbCache.get(card.blob);
  const p = (async () => {
    if (isVideo(card.name)) {
      try {
        const { el, url } = await mediaElement(card.blob, true);
        el.currentTime = Math.min(0.4, (el.duration || 1) / 3);
        await new Promise((resolve) => {
          let settled = false;
          const ok = () => { if (!settled) { settled = true; resolve(); } };
          el.onseeked = ok;
          el.onloadeddata = ok;
          setTimeout(ok, 2500);
        });
        const canvas = document.createElement("canvas");
        canvas.width = 84;
        canvas.height = 60;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#1f2223";
        ctx.fillRect(0, 0, 84, 60);
        if (el.videoWidth && el.videoHeight) {
          const s = Math.max(84 / el.videoWidth, 60 / el.videoHeight);
          const w = el.videoWidth * s;
          const h = el.videoHeight * s;
          ctx.drawImage(el, (84 - w) / 2, (60 - h) / 2, w, h);
        }
        URL.revokeObjectURL(url);
        return canvas.toDataURL("image/jpeg", 0.8);
      } catch {
        return null;
      }
    }
    if (isAudio(card.name) && card.size < 24 * 1024 * 1024) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        const ac = new AC();
        const buf = await ac.decodeAudioData(await card.blob.arrayBuffer());
        const data = buf.getChannelData(0);
        const canvas = document.createElement("canvas");
        canvas.width = 84;
        canvas.height = 60;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#f6efe9";
        ctx.fillRect(0, 0, 84, 60);
        ctx.strokeStyle = "#f35b28";
        ctx.lineWidth = 1.4;
        const step = Math.max(1, Math.floor(data.length / 84));
        ctx.beginPath();
        for (let x = 0; x < 84; x += 1) {
          let peak = 0;
          for (let j = 0; j < step; j += 16) peak = Math.max(peak, Math.abs(data[x * step + j] || 0));
          const h = Math.max(1, peak * 50);
          ctx.moveTo(x + 0.5, 30 - h);
          ctx.lineTo(x + 0.5, 30 + h);
        }
        ctx.stroke();
        ac.close();
        return canvas.toDataURL("image/png");
      } catch {
        return null;
      }
    }
    return null;
  })();
  thumbCache.set(card.blob, p);
  return p;
}

export async function mediaDetails(card) {
  const info = await mediaInfo(card);
  const parts = [];
  if (info.duration) parts.push(durationText(info.duration));
  if (info.width && info.height) parts.push(`${info.width} × ${info.height}`);
  return {
    dimensions: info.width && info.height ? `${info.width} × ${info.height}` : "",
    duration: info.duration ? durationText(info.duration) : "",
    meta: parts.join(" · "),
  };
}

/* ------------------------------------------------------------------ ffmpeg */
let activeCtx = null;

async function engine(ctx) {
  const ff = await loadFFmpeg(
    (p) => activeCtx?.progress?.(0.08 + p * 0.86),
    (line) => activeCtx?.log?.(line),
  );
  return ff;
}

function inName(card) {
  const ext = extension(card.name) || (isVideo(card.name) ? "mp4" : "mp3");
  return `in_${Math.random().toString(36).slice(2)}.${ext}`;
}

async function runFFmpeg(card, args, outExt, ctx, extraInputs = []) {
  activeCtx = ctx;
  const ff = await engine(ctx);
  if (ctx.isCancelled?.()) throw new DOMException("Cancelled", "AbortError");
  ctx.engineReady?.();
  const input = inName(card);
  const output = `out.${outExt}`;
  const written = [];
  try {
    await ff.writeFile(input, new Uint8Array(await card.blob.arrayBuffer()));
    written.push(input);
    for (const extra of extraInputs) {
      const name = inName(extra.card);
      await ff.writeFile(name, new Uint8Array(await extra.card.blob.arrayBuffer()));
      written.push(name);
      extra.name = name;
    }
    ctx.progress?.(0.1);
    const code = await ff.exec(args(input, output, extraInputs));
    if (code !== 0) throw new Error("The media engine could not complete this conversion.");
    const data = await ff.readFile(output);
    return new Blob([data], { type: mimeFor(outExt) });
  } finally {
    for (const name of [...written, output]) {
      try { await ff.deleteFile(name); } catch { /* already gone */ }
    }
    activeCtx = null;
  }
}

function videoCodec(ext, quality = 23) {
  switch (ext) {
    case "webm":
      return ["-c:v", "libvpx", "-crf", "30", "-b:v", "0", "-c:a", "libvorbis", "-b:a", "128k"];
    case "gif":
      return [];
    default:
      return ["-c:v", "libx264", "-preset", "veryfast", "-crf", String(quality), "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k"];
  }
}

function audioCodec(ext, bitrate = "192k") {
  switch (ext) {
    case "mp3": return ["-c:a", "libmp3lame", "-q:a", "2"];
    case "m4a": return ["-c:a", "aac", "-b:a", bitrate];
    case "wav": return ["-c:a", "pcm_s16le"];
    case "flac": return ["-c:a", "flac"];
    case "ogg": return ["-c:a", "libvorbis", "-q:a", "5"];
    case "opus": return ["-c:a", "libopus", "-b:a", bitrate];
    case "aiff": return ["-c:a", "pcm_s16be"];
    default: return ["-c:a", "aac", "-b:a", bitrate];
  }
}

function evenScale() {
  return ["-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2"];
}

export async function convertMedia(card, target, opts = {}, ctx = {}) {
  const ext = target.key;
  if (isVideo(card.name)) {
    if (["mp3", "m4a", "wav", "flac", "ogg", "opus", "aiff"].includes(ext)) {
      const blob = await runFFmpeg(card, (input, output) => [
        "-y", "-i", input, "-vn", ...audioCodec(ext, "192k"), output,
      ], ext, ctx);
      return [{ name: `${stem(card.name)}.${ext}`, blob }];
    }
    if (ext === "gif") {
      const width = Math.min(720, Number(opts.width) || 640);
      const blob = await runFFmpeg(card, (input, output) => [
        "-y", "-i", input, "-vf",
        `fps=12,scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
        "-loop", "0", output,
      ], "gif", ctx);
      return [{ name: `${stem(card.name)}.gif`, blob }];
    }
    const blob = await runFFmpeg(card, (input, output) => [
      "-y", "-i", input,
      ...evenScale(),
      ...videoCodec(ext, 23),
      ...(ext === "mp4" || ext === "mov" ? ["-movflags", "+faststart"] : []),
      output,
    ], ext, ctx);
    return [{ name: `${stem(card.name)}.${ext}`, blob }];
  }

  const blob = await runFFmpeg(card, (input, output) => [
    "-y", "-i", input, "-vn", ...audioCodec(ext, "192k"), output,
  ], ext, ctx);
  return [{ name: `${stem(card.name)}.${ext}`, blob }];
}

/* ------------------------------------------------------------------- tools */
function toolOutExt(card, audioOnly = false) {
  const ext = extension(card.name);
  if (audioOnly) return ["mp3", "m4a", "wav", "flac", "ogg", "opus", "aiff"].includes(ext) ? ext : "mp3";
  return ["mp4", "mov", "mkv", "webm"].includes(ext) ? ext : "mp4";
}

async function mediaDuration(card) {
  const info = await mediaInfo(card);
  return info.duration || 0;
}

export async function runMediaTool(card, tool, opts = {}, ctx = {}) {
  const video = isVideo(card.name);
  const ext = toolOutExt(card, !video);
  const suffix = {
    trim: "Trimmed", crop_video: "Cropped", compress_video: "Compressed",
    split: "Part", merge: "Merged", rotate_video: "Rotated", speed: "Speed",
    snapshot: "Snapshot", mute: "Muted", remove_meta: "Clean",
    compress_audio: "Compressed", normalise: "Normalised",
  }[tool.key] || "Edited";

  if (tool.key === "trim") {
    const start = Math.max(0, Number(opts.start) || 0);
    const end = Number(opts.end) || 0;
    const dur = end > start ? end - start : 0;
    const blob = await runFFmpeg(card, (input, output) => [
      "-y", "-ss", String(start), "-i", input,
      ...(dur ? ["-t", String(dur)] : []),
      ...(video ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac"] : audioCodec(ext)),
      output,
    ], ext, ctx);
    return [{ name: `${stem(card.name)} Trimmed.${ext}`, blob }];
  }

  if (tool.key === "compress_video" && video) {
    const crf = Math.min(34, Math.max(18, Number(opts.crf) || 26));
    const blob = await runFFmpeg(card, (input, output) => [
      "-y", "-i", input, ...evenScale(), ...videoCodec(ext, crf), output,
    ], ext, ctx);
    return [{ name: `${stem(card.name)} Compressed.${ext}`, blob }];
  }

  if (tool.key === "compress_audio" && !video) {
    const bitrate = opts.bitrate || "128k";
    const blob = await runFFmpeg(card, (input, output) => [
      "-y", "-i", input, "-vn", ...audioCodec(ext, bitrate), output,
    ], ext, ctx);
    return [{ name: `${stem(card.name)} Compressed.${ext}`, blob }];
  }

  if (tool.key === "crop_video" && video) {
    const w = Number(opts.width) || 0;
    const h = Number(opts.height) || 0;
    const x = Math.max(0, Number(opts.x) || 0);
    const y = Math.max(0, Number(opts.y) || 0);
    const filter = `crop=${w || "iw"}:${h || "ih"}:${x}:${y},scale=trunc(iw/2)*2:trunc(ih/2)*2`;
    const blob = await runFFmpeg(card, (input, output) => [
      "-y", "-i", input, "-vf", filter, ...videoCodec(ext, 23), output,
    ], ext, ctx);
    return [{ name: `${stem(card.name)} Cropped.${ext}`, blob }];
  }

  if (tool.key === "rotate_video" && video) {
    const angle = Number(opts.angle) || 90;
    const filter = angle === 180 ? "hflip,vflip" : angle === 270 ? "transpose=2" : "transpose=1";
    const blob = await runFFmpeg(card, (input, output) => [
      "-y", "-i", input, "-vf", filter, ...videoCodec(ext, 23), output,
    ], ext, ctx);
    return [{ name: `${stem(card.name)} Rotated.${ext}`, blob }];
  }

  if (tool.key === "speed" && video) {
    const factor = Math.min(4, Math.max(0.25, Number(opts.factor) || 2));
    const atempo = [];
    let f = factor;
    while (f > 2) { atempo.push("atempo=2"); f /= 2; }
    while (f < 0.5) { atempo.push("atempo=0.5"); f /= 0.5; }
    atempo.push(`atempo=${f.toFixed(3)}`);
    const args = (input, output) => [
      "-y", "-i", input,
      "-filter_complex", `[0:v]setpts=PTS/${factor}[v];[0:a]${atempo.join(",")}[a]`,
      "-map", "[v]", "-map", "[a]", ...videoCodec(ext, 23), output,
    ];
    try {
      const blob = await runFFmpeg(card, args, ext, ctx);
      return [{ name: `${stem(card.name)} Speed.${ext}`, blob }];
    } catch {
      // Silent video: there is no audio stream to speed up.
      const blob = await runFFmpeg(card, (input, output) => [
        "-y", "-i", input, "-vf", `setpts=PTS/${factor}`, "-an", ...videoCodec(ext, 23), output,
      ], ext, ctx);
      return [{ name: `${stem(card.name)} Speed.${ext}`, blob }];
    }
  }

  if (tool.key === "speed" && !video) {
    const factor = Math.min(4, Math.max(0.25, Number(opts.factor) || 2));
    const atempo = [];
    let f = factor;
    while (f > 2) { atempo.push("atempo=2"); f /= 2; }
    while (f < 0.5) { atempo.push("atempo=0.5"); f /= 0.5; }
    atempo.push(`atempo=${f.toFixed(3)}`);
    const blob = await runFFmpeg(card, (input, output) => [
      "-y", "-i", input, "-af", atempo.join(","), ...audioCodec(ext), output,
    ], ext, ctx);
    return [{ name: `${stem(card.name)} Speed.${ext}`, blob }];
  }

  if (tool.key === "snapshot" && video) {
    const at = Math.max(0, Number(opts.at) || 0);
    const fmt = opts.format === "jpg" ? "jpg" : "png";
    const blob = await runFFmpeg(card, (input, output) => [
      "-y", "-ss", String(at), "-i", input, "-frames:v", "1",
      ...(fmt === "jpg" ? ["-q:v", "2"] : []), output,
    ], fmt, ctx);
    return [{ name: `${stem(card.name)} Snapshot.${fmt}`, blob }];
  }

  if (tool.key === "mute" && video) {
    const blob = await runFFmpeg(card, (input, output) => [
      "-y", "-i", input, "-an", "-c:v", "copy", output,
    ], ext, ctx);
    return [{ name: `${stem(card.name)} Muted.${ext}`, blob }];
  }

  if (tool.key === "remove_meta") {
    const blob = await runFFmpeg(card, (input, output) => [
      "-y", "-i", input, "-map_metadata", "-1", "-c", "copy", output,
    ], ext, ctx);
    return [{ name: `${stem(card.name)} Clean.${ext}`, blob }];
  }

  if (tool.key === "normalise" && !video) {
    const blob = await runFFmpeg(card, (input, output) => [
      "-y", "-i", input, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", ...audioCodec(ext), output,
    ], ext, ctx);
    return [{ name: `${stem(card.name)} Normalised.${ext}`, blob }];
  }

  if (tool.key === "split") {
    const parts = Math.max(2, Math.min(20, Number(opts.parts) || 2));
    const total = await mediaDuration(card);
    const outExt = ext;
    const names = [];
    if (total) {
      const slice = total / parts;
      const results = [];
      for (let i = 0; i < parts; i += 1) {
        const start = i * slice;
        const dur = i === parts - 1 ? Math.max(0.1, total - start) : slice;
        const blob = await runFFmpeg(card, (input, output) => [
          "-y", "-ss", String(start), "-i", input, "-t", String(dur),
          ...(video ? videoCodec(outExt) : audioCodec(outExt)), output,
        ], outExt, ctx);
        results.push({ name: `${stem(card.name)} ${i + 1}.${outExt}`, blob });
        ctx.progress?.((i + 1) / parts);
      }
      return results;
    }
    throw new Error("The length of this file could not be read, so it cannot be split evenly.");
  }

  if (tool.key === "merge") {
    const cards = (ctx.selection?.length ? ctx.selection : [card]).filter((c) => c.category === card.category);
    if (cards.length < 2) throw new Error("Select at least two files to merge.");
    activeCtx = ctx;
    const ff = await engine(ctx);
    ctx.engineReady?.();
    const written = [];
    const listName = `list_${Math.random().toString(36).slice(2)}.txt`;
    const output = `out.${ext}`;
    try {
      const lines = [];
      for (const c of cards) {
        const name = inName(c);
        await ff.writeFile(name, new Uint8Array(await c.blob.arrayBuffer()));
        written.push(name);
        lines.push(`file '${name}'`);
      }
      await ff.writeFile(listName, new TextEncoder().encode(lines.join("\n")));
      written.push(listName);
      const code = await ff.exec([
        "-y", "-f", "concat", "-safe", "0", "-i", listName,
        ...(video ? ["-c:v", "libx264", "-crf", "23", "-c:a", "aac"] : audioCodec(ext)),
        output,
      ]);
      if (code !== 0) throw new Error("These files could not be joined. Try files recorded in the same format.");
      const data = await ff.readFile(output);
      return [{ name: `${stem(card.name)} Merged.${ext}`, blob: new Blob([data], { type: mimeFor(ext) }) }];
    } finally {
      for (const name of [...written, output]) {
        try { await ff.deleteFile(name); } catch { /* gone */ }
      }
      activeCtx = null;
    }
  }

  throw new Error(`Unknown media tool: ${tool.key}`);
}

export function mediaMetaLine(card, info) {
  return [durationText(info.duration), formatBytes(card.size)].filter(Boolean).join(" · ");
}

export async function abortMedia() {
  await resetFFmpeg();
}
