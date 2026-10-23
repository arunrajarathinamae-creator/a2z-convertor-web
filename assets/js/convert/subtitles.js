/* Subtitles: SRT and VTT are both plain text and both easy to keep honest. */

import { stem } from "../catalog.js";
import { formatTimecode, parseTimecode } from "../util.js";

export function parseSubtitles(text) {
  const src = text.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
  const blocks = src.split(/\n{2,}/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    if (!lines.length) continue;
    if (/^WEBVTT/i.test(lines[0])) continue;
    let i = 0;
    if (/^\d+$/.test(lines[0].trim())) i = 1;
    const timeLine = lines[i];
    if (!timeLine || !timeLine.includes("-->")) continue;
    const m = timeLine.match(/(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}|\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}|\d{1,2}:\d{2}[.,]\d{1,3})/);
    if (!m) continue;
    cues.push({
      start: parseTimecode(m[1]),
      end: parseTimecode(m[2]),
      text: lines.slice(i + 1).join("\n"),
    });
  }
  return cues;
}

function toSrt(cues, shift = 0) {
  return cues.map((c, i) => `${i + 1}\n${formatTimecode(c.start + shift, true)} --> ${formatTimecode(c.end + shift, true)}\n${c.text}`).join("\n\n") + "\n";
}

function toVtt(cues, shift = 0) {
  return `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${formatTimecode(c.start + shift, false)} --> ${formatTimecode(c.end + shift, false)}\n${c.text}`).join("\n\n")}\n`;
}

function toTxt(cues) {
  return cues.map((c) => c.text).join("\n\n") + "\n";
}

export async function readSubtitles(blob) {
  return parseSubtitles(await blob.text());
}

export async function convertSubtitles(card, target) {
  const cues = await readSubtitles(card.blob);
  if (!cues.length) throw new Error("No subtitle cues were found in this file.");
  const base = stem(card.name);
  if (target.key === "srt") return [{ name: `${base}.srt`, blob: new Blob([toSrt(cues)], { type: "application/x-subrip" }) }];
  if (target.key === "vtt") return [{ name: `${base}.vtt`, blob: new Blob([toVtt(cues)], { type: "text/vtt" }) }];
  if (target.key === "txt") return [{ name: `${base}.txt`, blob: new Blob([toTxt(cues)], { type: "text/plain" }) }];
  throw new Error(`No subtitle conversion for ${target.key}.`);
}

export async function runSubtitleTool(card, tool, opts = {}) {
  const cues = await readSubtitles(card.blob);
  if (!cues.length) throw new Error("No subtitle cues were found in this file.");
  const base = stem(card.name);
  if (tool.key === "shift_time") {
    const shift = Number(opts.seconds) || 0;
    const shifted = cues.map((c) => ({ ...c, start: Math.max(0, c.start + shift), end: Math.max(0, c.end + shift) }));
    const ext = card.name.toLowerCase().endsWith(".vtt") ? "vtt" : "srt";
    const out = ext === "vtt" ? toVtt(shifted) : toSrt(shifted);
    return [{ name: `${base} Shifted.${ext}`, blob: new Blob([out], { type: ext === "vtt" ? "text/vtt" : "application/x-subrip" }) }];
  }
  if (tool.key === "remove_meta") {
    const ext = card.name.toLowerCase().endsWith(".vtt") ? "vtt" : "srt";
    const out = ext === "vtt" ? toVtt(cues) : toSrt(cues);
    return [{ name: `${base} Clean.${ext}`, blob: new Blob([out], { type: ext === "vtt" ? "text/vtt" : "application/x-subrip" }) }];
  }
  throw new Error(`Unknown subtitle tool: ${tool.key}`);
}
