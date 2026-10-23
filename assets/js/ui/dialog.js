/* Modal sheets: one shape for every dialog, so a tool dialog, the batch
 * chooser and Help all feel like the same application. */

import { icon } from "./icons.js";
import { escapeHtml } from "../util.js";

export function openModal({ title, subtitle = "", body = "", footer = "", width = "560px", cls = "", onClose = null }) {
  const root = document.getElementById("modal-root");
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}" style="max-width:${width}">
    <header class="sheet-head">
      <button class="icon-btn sheet-x" data-close aria-label="Close">${icon("close", 17)}</button>
      <h2 class="sheet-title">${escapeHtml(title)}</h2>
      <span class="sheet-head-spacer"></span>
    </header>
    <div class="sheet-body">
      ${subtitle ? `<p class="sheet-sub">${subtitle}</p>` : ""}
      ${body}
    </div>
    <footer class="sheet-foot">${footer}</footer>
  </div>`;
  root.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add("in"));
  const close = () => {
    wrap.classList.remove("in");
    setTimeout(() => {
      wrap.remove();
      onClose?.();
    }, 160);
  };
  wrap.addEventListener("mousedown", (e) => {
    if (e.target === wrap) close();
  });
  wrap.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      document.removeEventListener("keydown", onKey);
    }
  };
  document.addEventListener("keydown", onKey);
  setTimeout(() => wrap.querySelector("input,select,button:not(.sheet-x)")?.focus(), 30);
  return { wrap, close };
}

function control(key, spec, value) {
  const id = `fld-${key}`;
  if (spec.type === "range") {
    return `<div class="field" data-key="${key}">
      <label for="${id}">${escapeHtml(spec.label)}</label>
      <input type="range" id="${id}" name="${key}" min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${value}">
      <output for="${id}">${value}${spec.unit || ""}</output>
    </div>`;
  }
  if (spec.type === "number") {
    return `<div class="field" data-key="${key}">
      <label for="${id}">${escapeHtml(spec.label)}</label>
      <input type="number" id="${id}" name="${key}" min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${value}">
      <span class="field-unit">${escapeHtml(spec.unit || "")}</span>
    </div>`;
  }
  if (spec.type === "select") {
    return `<div class="field" data-key="${key}">
      <label for="${id}">${escapeHtml(spec.label)}</label>
      <select id="${id}" name="${key}">${spec.options.map(([v, l]) => `<option value="${escapeHtml(v)}"${String(v) === String(value) ? " selected" : ""}>${escapeHtml(l)}</option>`).join("")}</select>
    </div>`;
  }
  if (spec.type === "check") {
    return `<div class="field field-check" data-key="${key}">
      <label for="${id}">${escapeHtml(spec.label)}</label>
      <input type="checkbox" id="${id}" name="${key}"${value ? " checked" : ""}>
      <span></span>
    </div>`;
  }
  return `<div class="field field-wide" data-key="${key}">
    <label for="${id}">${escapeHtml(spec.label)}</label>
    <input type="text" id="${id}" name="${key}" value="${escapeHtml(value ?? "")}" placeholder="${escapeHtml(spec.placeholder || "")}" maxlength="${spec.maxlength || 500}">
    <span></span>
  </div>`;
}

function valuesOf(wrap) {
  const out = {};
  for (const field of wrap.querySelectorAll(".field[data-key]")) {
    const key = field.dataset.key;
    const input = field.querySelector("input,select");
    if (!input) continue;
    if (input.type === "checkbox") out[key] = input.checked;
    else if (input.type === "range" || input.type === "number") out[key] = Number(input.value);
    else out[key] = input.value;
  }
  return out;
}

export function openFields({
  title, subtitle = "", fields = {}, values = {}, applyLabel = "Apply",
  preview = null, note = "", wide = false, allowReset = true,
}) {
  return new Promise((resolve) => {
    const body = `
      ${preview ? `<div class="dialog-preview" id="dialog-preview">${preview.html || ""}</div>` : ""}
      <div class="fields ${wide ? "fields-wide" : ""}">
        ${Object.entries(fields).map(([k, spec]) => control(k, spec, values[k] ?? spec.value)).join("")}
      </div>
      ${note ? `<p class="sheet-note">${note}</p>` : ""}
      <p class="sheet-error" id="sheet-error" hidden></p>`;
    const footer = `
      ${allowReset ? `<button class="btn ghost" id="dlg-reset">Reset</button>` : "<span></span>"}
      <span class="grow"></span>
      <button class="btn ghost" id="dlg-cancel">Cancel</button>
      <button class="btn primary" id="dlg-apply">${escapeHtml(applyLabel)}</button>`;
    const { wrap, close } = openModal({
      title, subtitle, body, footer, width: wide ? "640px" : "560px",
      onClose: () => resolve(null),
    });
    const refresh = () => {
      const v = valuesOf(wrap);
      for (const field of wrap.querySelectorAll(".field[data-key]")) {
        const out = field.querySelector("output");
        const spec = fields[field.dataset.key];
        if (out) out.textContent = `${v[field.dataset.key]}${spec?.unit || ""}`;
      }
      if (preview) {
        const target = wrap.querySelector("#dialog-preview");
        if (target) preview.update?.(v, target);
      }
    };
    wrap.addEventListener("input", refresh);
    wrap.querySelectorAll(".field input, .field select").forEach((el) => {
      el.addEventListener("input", refresh);
      el.addEventListener("change", refresh);
    });
    refresh();

    wrap.querySelector("#dlg-reset")?.addEventListener("click", () => {
      for (const [k, spec] of Object.entries(fields)) {
        const input = wrap.querySelector(`[name="${k}"]`);
        if (!input) continue;
        if (input.type === "checkbox") input.checked = !!spec.value;
        else input.value = spec.value;
      }
      refresh();
    });
    wrap.querySelector("#dlg-cancel").addEventListener("click", () => { close(); resolve(null); });
    wrap.querySelector("#dlg-apply").addEventListener("click", async () => {
      const btn = wrap.querySelector("#dlg-apply");
      const err = wrap.querySelector("#sheet-error");
      err.hidden = true;
      btn.disabled = true;
      try {
        resolve(valuesOf(wrap));
        close();
      } catch (e) {
        err.textContent = e.message || String(e);
        err.hidden = false;
        btn.disabled = false;
      }
    });
    wrap.querySelector("[data-close]").addEventListener("click", () => resolve(null), { once: true });
    wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) resolve(null); }, { once: true });
    wrap.querySelector("#dlg-apply").focus();
  });
}

export function openText(title, body, { width = "560px", cls = "" } = {}) {
  const { close } = openModal({
    title, body, width, cls,
    footer: `<span class="grow"></span><button class="btn primary" data-close>Done</button>`,
  });
  return close;
}

export function openConfirm(title, message, { applyLabel = "Continue" } = {}) {
  return new Promise((resolve) => {
    const { wrap, close } = openModal({
      title,
      body: `<p class="sheet-text">${message}</p>`,
      footer: `<span class="grow"></span><button class="btn ghost" id="c-cancel">Cancel</button><button class="btn primary" id="c-ok">${escapeHtml(applyLabel)}</button>`,
      width: "440px",
      onClose: () => resolve(false),
    });
    wrap.querySelector("#c-cancel").addEventListener("click", () => { close(); resolve(false); });
    wrap.querySelector("#c-ok").addEventListener("click", () => { close(); resolve(true); });
    wrap.querySelector("[data-close]").addEventListener("click", () => resolve(false), { once: true });
  });
}
