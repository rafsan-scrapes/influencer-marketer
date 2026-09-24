// src/templateEditor.js — Email Template tab UI. Owns the panel DOM only.
// Template state lives in store.js ("templates"); CSV headers come from
// store.js ("brands") plus `im:headers-changed` events from brands.js.

import { store } from "./store.js";
import { escapeHtml } from "./brands.js";

export const OPS = ["equals", "contains", "isEmpty"];

let lastFocused = null;
let idCounter = 0;

export function createConditionBlock() {
  idCounter += 1;
  return {
    id: `c${Date.now().toString(36)}${idCounter}`,
    conditions: [{ column: "", op: "equals", value: "" }],
    subject: "",
    body: "",
    prompt: ""
  };
}

// Pure helper (unit-tested): reorder a block id by dir (-1 up, +1 down).
export function moveBlockId(ids, id, dir) {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return ids.slice();
  const next = ids.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function getState() {
  return store.getTemplates();
}

function els() {
  return {
    panel: document.getElementById("panel-email-template"),
    chips: document.getElementById("template-chips"),
    defSubject: document.getElementById("tpl-def-subject"),
    defBody: document.getElementById("tpl-def-body"),
    defPrompt: document.getElementById("tpl-def-prompt"),
    conditions: document.getElementById("template-conditions"),
    addBtn: document.getElementById("template-add-condition")
  };
}

export function renderChips(headers) {
  const { chips } = els();
  if (!chips) return;
  if (!headers || headers.length === 0) {
    chips.innerHTML = '<p class="text-sm text-slate-500">Upload a CSV on the Brands tab to see column chips.</p>';
    return;
  }
  chips.innerHTML = headers
    .map(
      (h) =>
        `<button type="button" data-chip="${escapeHtml(h)}" title="Insert [${escapeHtml(h)}]" ` +
        `class="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300">${escapeHtml(h)}</button>`
    )
    .join("");
}

function conditionRowHtml(row, headers) {
  const colSelect =
    headers.length > 0
      ? `<select data-field="column" class="rounded border border-slate-300 px-2 py-1 text-sm">` +
        `<option value="">— column —</option>` +
        headers.map((h) => `<option value="${escapeHtml(h)}"${h === row.column ? " selected" : ""}>${escapeHtml(h)}</option>`).join("") +
        `</select>`
      : `<input data-field="column" type="text" value="${escapeHtml(row.column)}" placeholder="Column" class="w-32 rounded border border-slate-300 px-2 py-1 text-sm" />`;
  return (
    `<div class="flex items-center gap-2" data-cond-row>` +
    colSelect +
    `<select data-field="op" class="rounded border border-slate-300 px-2 py-1 text-sm">` +
    OPS.map((op) => `<option value="${op}"${op === row.op ? " selected" : ""}>${op}</option>`).join("") +
    `</select>` +
    `<input data-field="value" type="text" value="${escapeHtml(row.value)}" placeholder="value" ` +
    `class="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"${row.op === "isEmpty" ? " disabled" : ""} />` +
    `<button type="button" data-action="del-row" class="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50" title="Remove condition">✕</button>` +
    `</div>`
  );
}

function blockHtml(block, headers, isFirst, isLast) {
  const rows = block.conditions
    .map(
      (row, i) =>
        (i > 0 ? '<div class="text-xs font-bold text-slate-400">AND</div>' : "") + conditionRowHtml(row, headers)
    )
    .join("");
  return (
    `<div class="rounded border border-slate-300 p-4" data-block-id="${escapeHtml(block.id)}">` +
    `<div class="mb-2 flex items-center justify-between">` +
    `<span class="text-sm font-semibold">If condition</span>` +
    `<span class="flex gap-1">` +
    `<button type="button" data-action="move-up"${isFirst ? " disabled" : ""} class="rounded px-2 py-1 text-sm hover:bg-slate-100 disabled:opacity-30" title="Move up">↑</button>` +
    `<button type="button" data-action="move-down"${isLast ? " disabled" : ""} class="rounded px-2 py-1 text-sm hover:bg-slate-100 disabled:opacity-30" title="Move down">↓</button>` +
    `<button type="button" data-action="del-block" class="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50" title="Delete block">Delete</button>` +
    `</span></div>` +
    `<div class="space-y-2" data-cond-rows>${rows}</div>` +
    `<button type="button" data-action="add-row" class="mt-2 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">+ AND condition</button>` +
    `<div class="mt-3 space-y-2">` +
    `<input data-field="subject" type="text" value="${escapeHtml(block.subject)}" placeholder="Subject" class="tpl-target w-full rounded border border-slate-300 px-3 py-2 text-sm" />` +
    `<textarea data-field="body" placeholder="Body" rows="3" class="tpl-target w-full rounded border border-slate-300 px-3 py-2 text-sm">${escapeHtml(block.body)}</textarea>` +
    `<textarea data-field="prompt" placeholder="Prompt (optional)" rows="2" class="tpl-target w-full rounded border border-slate-300 px-3 py-2 text-sm">${escapeHtml(block.prompt)}</textarea>` +
    `</div></div>`
  );
}

export function renderConditions() {
  const { conditions } = els();
  if (!conditions) return;
  const state = getState();
  const headers = store.getBrands().headers;
  conditions.innerHTML = state.conditions
    .map((b, i) => blockHtml(b, headers, i === 0, i === state.conditions.length - 1))
    .join("");
}

function readStateFromDom() {
  const { defSubject, defBody, defPrompt, conditions } = els();
  const blocks = [...(conditions ? conditions.querySelectorAll("[data-block-id]") : [])].map((el) => {
    const condRows = [...el.querySelectorAll("[data-cond-row]")].map((r) => ({
      column: r.querySelector('[data-field="column"]').value,
      op: r.querySelector('[data-field="op"]').value,
      value: r.querySelector('[data-field="value"]').value
    }));
    return {
      id: el.getAttribute("data-block-id"),
      conditions: condRows,
      subject: el.querySelector('[data-field="subject"]').value,
      body: el.querySelector('[data-field="body"]').value,
      prompt: el.querySelector('[data-field="prompt"]').value
    };
  });
  return {
    default: {
      subject: defSubject ? defSubject.value : "",
      body: defBody ? defBody.value : "",
      prompt: defPrompt ? defPrompt.value : ""
    },
    conditions: blocks
  };
}

export function persistFromDom() {
  store.setTemplates(readStateFromDom());
}

function insertAtCursor(input, text) {
  const start = input.selectionStart == null ? input.value.length : input.selectionStart;
  const end = input.selectionEnd == null ? input.value.length : input.selectionEnd;
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  const pos = start + text.length;
  input.setSelectionRange(pos, pos);
  input.focus();
}

export function initTemplateEditor() {
  const { panel, chips, defSubject, defBody, defPrompt, conditions, addBtn } = els();
  if (!panel || !defSubject || !conditions) return;
  lastFocused = null;

  // Restore persisted state.
  const state = getState();
  defSubject.value = state.default.subject;
  defBody.value = state.default.body;
  defPrompt.value = state.default.prompt;
  renderConditions();
  renderChips(store.getBrands().headers);

  panel.addEventListener("focusin", (e) => {
    if (e.target && e.target.classList && e.target.classList.contains("tpl-target")) {
      lastFocused = e.target;
    }
  });

  panel.addEventListener("input", (e) => {
    if (e.target && e.target.closest && e.target.closest("#panel-email-template")) persistFromDom();
  });
  panel.addEventListener("change", (e) => {
    const t = e.target;
    if (!t || !t.closest || !t.closest("#panel-email-template")) return;
    // Toggling the value box for isEmpty needs no re-render.
    if (t.getAttribute("data-field") === "op") {
      const row = t.closest("[data-cond-row]");
      const val = row && row.querySelector('[data-field="value"]');
      if (val) val.disabled = t.value === "isEmpty";
    }
    persistFromDom();
  });

  if (chips) {
    chips.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("[data-chip]") : null;
      if (!btn) return;
      const target = lastFocused && document.contains(lastFocused) ? lastFocused : defSubject;
      insertAtCursor(target, `[${btn.getAttribute("data-chip")}]`);
      persistFromDom();
    });
  }

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const s = getState();
      s.conditions.push(createConditionBlock());
      store.setTemplates(s);
      renderConditions();
    });
  }

  conditions.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest("[data-action]") : null;
    if (!btn) return;
    const blockEl = btn.closest("[data-block-id]");
    const id = blockEl ? blockEl.getAttribute("data-block-id") : null;
    // Text state is always current in the store (persisted on every input/
    // change event), so structural edits can go store -> mutate -> re-render.
    const s = getState();
    const action = btn.getAttribute("data-action");
    if (action === "del-block") {
      s.conditions = s.conditions.filter((b) => b.id !== id);
    } else if (action === "move-up" || action === "move-down") {
      const order = moveBlockId(s.conditions.map((b) => b.id), id, action === "move-up" ? -1 : 1);
      s.conditions.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    } else if (action === "add-row") {
      const b = s.conditions.find((x) => x.id === id);
      if (b) b.conditions.push({ column: "", op: "equals", value: "" });
    } else if (action === "del-row") {
      const b = s.conditions.find((x) => x.id === id);
      if (b && b.conditions.length > 1) {
        const rows = [...blockEl.querySelectorAll("[data-cond-row]")];
        b.conditions.splice(rows.indexOf(btn.closest("[data-cond-row]")), 1);
      }
    }
    store.setTemplates(s);
    renderConditions();
  });

  window.addEventListener("im:headers-changed", (e) => {
    renderChips(e.detail ? e.detail.headers : []);
    renderConditions();
  });
}
