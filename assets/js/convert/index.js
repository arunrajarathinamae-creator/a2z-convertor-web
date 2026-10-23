/* One dispatcher for every door into a conversion.
 *
 * The stage tile, the wheel and the inspector button all call this, so they
 * cannot disagree about quality, options or naming.
 */

import { OPTION_FIELDS, categoryByKey, readReason } from "../catalog.js";
import { convertImage, runImageTool } from "./image.js";
import { convertMedia, runMediaTool } from "./media.js";
import { convertPdf, runPdfTool } from "./pdf.js";
import {
  convertDocument, convertSheet, convertSlides, runDocumentTool, runSheetTool,
} from "./docs.js";
import { convertSubtitles, runSubtitleTool } from "./subtitles.js";
import { convertArchive, runArchiveTool } from "./archives.js";

export function fieldsFor(target, card = null) {
  if (target.key === "split" && card?.category === "pdf") return OPTION_FIELDS.split_pdf || {};
  return OPTION_FIELDS[target.key] || {};
}

export function defaultOptionsFor(target, card = null) {
  const fields = fieldsFor(target, card);
  const out = {};
  for (const [key, spec] of Object.entries(fields)) out[key] = spec.value;
  return out;
}

export function defaultOptions(target) {
  return defaultOptionsFor(target, null);
}

export function outputExtension(target, card) {
  if (target.kind !== "format") return "";
  if (target.key === "gzip") return "gz";
  if (target.key === "jpeg") return "jpg";
  return target.key;
}

export async function runConversion(card, target, opts = {}, ctx = {}) {
  if (!card) throw new Error("No file is selected.");
  const reason = readReason(card.name);
  if (reason) throw new Error(reason);
  const cat = categoryByKey(card.category);
  if (!cat && target.key !== "compress_archive" && target.key !== "extract") {
    throw new Error("This file is not in the catalogue.");
  }

  if (target.kind === "format") {
    switch (card.category) {
      case "image": return convertImage(card, target, opts, ctx);
      case "video":
      case "audio": return convertMedia(card, target, opts, ctx);
      case "pdf": return convertPdf(card, target, opts, ctx);
      case "document": return convertDocument(card, target, opts, ctx);
      case "slides": return convertSlides(card, target, opts, ctx);
      case "sheet": return convertSheet(card, target, opts, ctx);
      case "subtitle": return convertSubtitles(card, target, opts, ctx);
      case "archive": return convertArchive(card, target, opts, ctx);
      default: throw new Error("There is nothing to convert this file into.");
    }
  }

  switch (card.category) {
    case "image": return runImageTool(card, target, opts, ctx);
    case "video":
    case "audio": return runMediaTool(card, target, opts, ctx);
    case "pdf": return runPdfTool(card, target, opts, ctx);
    case "document": return runDocumentTool(card, target, opts, ctx);
    case "sheet": return runSheetTool(card, target, opts, ctx);
    case "slides": {
      if (target.key === "remove_meta") {
        return [{ name: `${card.name.replace(/\.[^.]+$/, "")} Clean.${card.ext}`, blob: new Blob([await card.blob.arrayBuffer()], { type: card.blob.type }) }];
      }
      throw new Error(`Unknown slide tool: ${target.key}`);
    }
    case "subtitle": return runSubtitleTool(card, target, opts, ctx);
    case "archive":
    case null:
    case undefined:
      return runArchiveTool(card, target, opts, ctx);
    default:
      throw new Error("There is nothing to do with this file in the browser.");
  }
}
