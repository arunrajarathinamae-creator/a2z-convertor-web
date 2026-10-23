/* The wheel: the signature of A2Z.
 *
 * Shift opens formats, Ctrl tools, Alt actions.  It floats over the stage,
 * can be dragged and scrolled smaller or larger, and answers the arrow keys
 * and Enter.  Releasing the modifier does not dismiss it, so the mouse can be
 * used without holding a key down; Esc or a click outside closes it.
 */

import { icon, formatIcon } from "./icons.js";
import { escapeHtml, clamp } from "../util.js";

const MODES = {
  formats: { title: "formats", key: "Shift", icon: "arrows" },
  tools: { title: "tools", key: "Ctrl", icon: "tools" },
  actions: { title: "actions", key: "Alt", icon: "cursor" },
};

export class Wheel {
  constructor({ layer, getCard, getSelection, getTargets, whyUnsupported, onApply, onUnsupported, onModeChange, onHide }) {
    this.layer = layer;
    this.getCard = getCard;
    this.getSelection = getSelection;
    this.getTargets = getTargets;
    this.whyUnsupported = whyUnsupported;
    this.onApply = onApply;
    this.onUnsupported = onUnsupported;
    this.onModeChange = onModeChange;
    this.onHide = onHide;
    this.ring = 0;
    this.open = false;
    this.mode = "formats";
    this.index = 0;
    this.items = [];
    this.card = null;
    this.drag = null;
    this._bindGlobal();
  }

  _state(mode = this.mode) {
    try {
      const raw = localStorage.getItem(`a2z.wheel.${mode}`);
      if (raw) return JSON.parse(raw);
    } catch { /* private mode */ }
    return { x: 0.5, y: 0.52, scale: 0.82 };
  }

  _save() {
    try {
      localStorage.setItem(`a2z.wheel.${this.mode}`, JSON.stringify({ x: this.x, y: this.y, scale: this.scale }));
    } catch { /* private mode */ }
  }

  setMode(mode) {
    if (!MODES[mode] || mode === this.mode) return;
    this._save();
    this.mode = mode;
    const state = this._state(mode);
    this.x = state.x;
    this.y = state.y;
    this.scale = state.scale;
    this.index = 0;
    const card = this.card || this.getCard();
    this.items = card ? (this.getTargets(this.mode, card) || []) : [];
    if (this.open) this.render();
    this.onModeChange?.(mode);
  }

  show(mode = this.mode) {
    const card = this.getCard();
    if (!card) {
      this.onUnsupported?.("Add a file first — the wheel acts on the file you are pointing at.");
      return;
    }
    this.mode = MODES[mode] ? mode : "formats";
    const state = this._state();
    this.x = state.x ?? 0.5;
    this.y = state.y ?? 0.52;
    this.scale = state.scale ?? 0.82;
    this.card = card;
    this.items = this.getTargets(this.mode, card) || [];
    this.index = 0;
    this.open = true;
    this.layer.hidden = false;
    this.layer.classList.remove("closing");
    this.render();
  }

  hide() {
    if (!this.open) return;
    this.open = false;
    this.layer.classList.add("closing");
    setTimeout(() => {
      if (!this.open) {
        this.layer.hidden = true;
        this.layer.innerHTML = "";
        this.layer.classList.remove("closing");
        this.layer.closest(".stage")?.classList.remove("wheel-open");
        this.onHide?.();
      }
    }, 150);
  }

  render() {
    if (!this.open) return;
    const stage = this.layer.closest(".stage");
    stage?.classList.add("wheel-open");
    const card = this.card || this.getCard();
    this.card = card;
    if (!card) { this.hide(); return; }
    const selection = this.getSelection();
    const w = this.layer.clientWidth || 800;
    const h = this.layer.clientHeight || 600;
    const base = Math.min(w, h);
    const scale = clamp(Number(this.scale) || 0.82, 0.55, 1.12);
    const ring = Math.max(210, base * scale);
    this.ring = ring;
    // Keep the ring on-screen after a previous drag or resize.  Without this a
    // persisted position could leave half the wheel under the inspector.
    const mx = Math.min(0.46, ring / (2 * w) + 0.02);
    const my = Math.min(0.46, ring / (2 * h) + 0.02);
    this.x = clamp(this.x, mx, 1 - mx);
    this.y = clamp(this.y, my, 1 - my);
    stage?.style.setProperty("--wheel-title-top", `${Math.max(8, h * this.y - ring / 2)}px`);
    const radius = ring * 0.35;
    const cardW = clamp(ring * 0.17, 64, 88);
    const cardH = cardW * 0.86;
    const meta = MODES[this.mode];
    const thumb = card.thumbURL;
    const preview = thumb
      ? `<img src="${thumb}" alt="">`
      : formatIcon(card.ext, 46);

    const cardsHtml = this.items.map((t, i) => {
      const reason = this.whyUnsupported(t, card, selection);
      const off = !!reason;
      const angle = (-90 + (360 / Math.max(1, this.items.length)) * i) * (Math.PI / 180);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const glyph = t.kind === "format"
        ? formatIcon(t.key, Math.max(26, cardW * 0.37), "")
        : `<span class="wheel-tool-ico">${icon(t.icon || "tools", Math.max(20, cardW * 0.3))}</span>`;
      return `<button class="wheel-card${t.kind === "format" ? " format" : ""}${off ? " off" : ""}${i === this.index ? " active" : ""}" data-i="${i}"
        style="--x:${x}px;--y:${y}px;--cw:${cardW}px;--ch:${cardH}px"
        title="${escapeHtml(reason || t.hint || t.label)}" ${off ? 'aria-disabled="true"' : ""}>
        ${glyph}
        <span class="wheel-card-label">${escapeHtml(t.label)}</span>
        ${off ? `<span class="wheel-lock">${icon("lock", 10)}</span>` : ""}
      </button>`;
    }).join("");

    this.layer.innerHTML = `
      <div class="wheel-backdrop"></div>
      <div class="wheel-stage" style="left:${this.x * 100}%;top:${this.y * 100}%;--ring:${ring}px;--cardw:${cardW}px;--cardh:${cardH}px">
        <div class="wheel-orbit"></div>
        <div class="wheel-hub" title="Drag to move">
          <div class="wheel-hub-preview">${preview}</div>
        </div>
        ${cardsHtml}
        <div class="wheel-keycap"><kbd>${meta.key}</kbd><span>${meta.title}</span></div>
        <div class="wheel-hint">Drag to move · Scroll to resize · Enter applies</div>
      </div>`;

    // position cards around the hub
    for (const el of this.layer.querySelectorAll(".wheel-card")) {
      const i = Number(el.dataset.i);
      const angle = (-90 + (360 / Math.max(1, this.items.length)) * i) * (Math.PI / 180);
      el.style.left = `calc(50% + ${Math.cos(angle) * radius}px)`;
      el.style.top = `calc(50% + ${Math.sin(angle) * radius}px)`;
      el.addEventListener("pointerenter", () => this._activate(i, false));
      el.addEventListener("click", (e) => { e.stopPropagation(); this.apply(i); });
    }
    this.layer.querySelector(".wheel-hub")?.addEventListener("pointerdown", (e) => this._startDrag(e));
    this.layer.querySelector(".wheel-orbit")?.addEventListener("pointerdown", (e) => this._startDrag(e));
    this.layer.querySelector(".wheel-backdrop")?.addEventListener("click", () => this.hide());
    this.layer.querySelector(".wheel-stage")?.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.scale = clamp(this.scale - Math.sign(e.deltaY) * 0.045, 0.55, 1.12);
      this.render();
      this._save();
    }, { passive: false });
  }

  _activate(i, rerender = true) {
    if (i < 0 || i >= this.items.length) return;
    this.index = i;
    if (rerender) {
      this.layer.querySelectorAll(".wheel-card").forEach((el, j) => el.classList.toggle("active", j === i));
    } else {
      this.layer.querySelectorAll(".wheel-card").forEach((el, j) => el.classList.toggle("active", j === i));
    }
  }

  _startDrag(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = this.layer.getBoundingClientRect();
    this.drag = { x: e.clientX, y: e.clientY, ox: this.x, oy: this.y, w: rect.width, h: rect.height };
    const mx = Math.min(0.46, this.ring / (2 * this.drag.w) + 0.02);
    const my = Math.min(0.46, this.ring / (2 * this.drag.h) + 0.02);
    const move = (ev) => {
      if (!this.drag) return;
      this.x = clamp(this.drag.ox + (ev.clientX - this.drag.x) / this.drag.w, mx, 1 - mx);
      this.y = clamp(this.drag.oy + (ev.clientY - this.drag.y) / this.drag.h, my, 1 - my);
      const stage = this.layer.querySelector(".wheel-stage");
      if (stage) {
        stage.style.left = `${this.x * 100}%`;
        stage.style.top = `${this.y * 100}%`;
      }
      this.layer.closest(".stage")?.style.setProperty(
        "--wheel-title-top",
        `${Math.max(8, this.drag.h * this.y - this.ring / 2)}px`,
      );
    };
    const up = () => {
      this.drag = null;
      this._save();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  apply(i = this.index) {
    const target = this.items[i];
    if (!target) return;
    const card = this.card || this.getCard();
    const reason = this.whyUnsupported(target, card, this.getSelection());
    if (reason) {
      this.onUnsupported?.(reason);
      return;
    }
    this.hide();
    this.onApply?.(target, card, this.mode);
  }

  move(delta) {
    if (!this.items.length) return;
    this.index = (this.index + delta + this.items.length) % this.items.length;
    this._activate(this.index);
    this.layer.querySelector(`.wheel-card[data-i="${this.index}"]`)?.focus({ preventScroll: true });
  }

  nudgeScale(delta) {
    this.scale = clamp(this.scale + delta, 0.55, 1.12);
    this.render();
    this._save();
  }

  resetScale() {
    this.scale = 0.82;
    this.x = 0.5;
    this.y = 0.52;
    this._save();
    this.render();
  }

  _bindGlobal() {
    window.addEventListener("keydown", (e) => {
      if (!this.open) return;
      if (e.key === "Escape") { e.preventDefault(); this.hide(); }
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); this.move(1); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); this.move(-1); }
      else if (e.key === "Enter") { e.preventDefault(); this.apply(); }
      else if (e.key === "+" || e.key === "=") { e.preventDefault(); this.nudgeScale(0.05); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); this.nudgeScale(-0.05); }
      else if (e.key === "0") { e.preventDefault(); this.resetScale(); }
    });
  }
}

export { MODES };
