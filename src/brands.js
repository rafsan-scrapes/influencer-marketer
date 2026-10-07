// src/brands.js — Brands tab: CSV upload + rows table with selection and
// sequential runs, plus header chips at the top of the Email Template tab.
// No AI calls and no placeholder logic here: the run pipeline lives in
// runner.js. Loaded CSV persists via store.js ("brands"); uploading replaces
// it and never touches runs. Selection and per-row statuses are session-only.

import { store } from "./store.js";
import { parseCsv } from "./csv.js";
import { runRows } from "./runner.js";
import { makeRunEntry, refreshRuns } from "./runs.js";

export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Pure HTML builders (DOM-free, unit-testable).
// opts: { selection: Set<number>, statuses: Map<number,{status,message}> }.
// When opts is omitted the plain table (no checkbox/status columns) renders.
export function renderBrandsTable(headers, rows, opts) {
  if (!headers || headers.length === 0) {
    return '<p class="text-sm text-slate-500">No CSV loaded yet.</p>';
  }
  const selectable = !!opts;
  const selection = (opts && opts.selection) || new Set();
  const statuses = (opts && opts.statuses) || new Map();
  const head =
    (selectable ? `<th class="border-b px-3 py-2 text-left"><span class="sr-only">Select</span></th>` : "") +
    headers.map((h) => `<th class="border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(h)}</th>`).join("") +
    (selectable ? `<th class="border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>` : "");
  const body = rows
    .map((row, i) => {
      const status = statuses.get(i) || { status: "idle", message: "" };
      return (
        `<tr class="border-b last:border-0 hover:bg-slate-50" data-row="${i}">` +
        (selectable
          ? `<td class="px-3 py-2"><input type="checkbox" data-select-row="${i}"${selection.has(i) ? " checked" : ""} aria-label="Select row ${i + 1}" /></td>`
          : "") +
        headers.map((h) => `<td class="px-3 py-2 text-sm">${escapeHtml(row[h])}</td>`).join("") +
        (selectable ? `<td class="px-3 py-2 text-sm">${renderStatus(status)}</td>` : "") +
        `</tr>`
      );
    })
    .join("");
  return (
    `<div class="overflow-x-auto"><table class="w-full border-collapse">` +
    `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
  );
}

const STATUS_STYLES = {
  idle: "bg-slate-100 text-slate-600",
  generating: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
  skipped: "bg-amber-100 text-amber-800"
};

export function renderStatus({ status, message }) {
  const pill =
    `<span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.idle}">${escapeHtml(status)}</span>`;
  return message
    ? pill + `<div class="mt-1 max-w-xs text-xs text-slate-600">${escapeHtml(message)}</div>`
    : pill;
}

export function renderHeaderChips(headers) {
  if (!headers || headers.length === 0) {
    return '<p class="text-sm text-slate-500">Upload a CSV on the Brands tab to see column chips.</p>';
  }
  return headers
    .map(
      (h) =>
        `<span class="inline-block rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700" title="[${escapeHtml(h)}]">${escapeHtml(h)}</span>`
    )
    .join("");
}

export function getHeaders() {
  return store.getBrands().headers;
}

// Session-only UI state (not persisted).
const selection = new Set();
const statuses = new Map();
let running = false;

export function selectAll(rows) {
  selection.clear();
  (rows || []).forEach((_, i) => selection.add(i));
}

export function resetStatuses() {
  statuses.clear();
}

function statusFor(i) {
  return statuses.get(i) || { status: "idle", message: "" };
}

function paint() {
  const { fileName, headers, rows } = store.getBrands();
  const status = document.getElementById("brands-status");
  const table = document.getElementById("brands-table");
  const chips = document.getElementById("template-chips");
  if (status) {
    status.textContent =
      headers.length === 0 ? "" : `${rows.length} row${rows.length === 1 ? "" : "s"} from ${fileName}`;
  }
  if (table) table.innerHTML = renderBrandsTable(headers, rows, { selection, statuses });
  if (chips) chips.innerHTML = renderHeaderChips(headers);
  // paint() also runs on every live status update — only notify the template
  // editor when the headers actually changed (e.g. a new CSV upload).
  const signature = JSON.stringify(headers);
  if (signature !== paint.lastHeaders) {
    paint.lastHeaders = signature;
    window.dispatchEvent(new CustomEvent("im:headers-changed", { detail: { headers } }));
  }
}
paint.lastHeaders = null;

function setRunUiEnabled(enabled) {
  for (const id of ["brands-run", "brands-select-all", "brands-deselect-all"]) {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  }
}

// Restore the previous run's per-row pills + Finished line when the same CSV
// (same file name + row count) is still loaded. Otherwise start clean.
function restoreLastRun() {
  let last;
  try {
    last = store.getLastRun();
  } catch {
    return;
  }
  if (!last || !Array.isArray(last.states) || last.states.length === 0) return;
  const { fileName, rows } = store.getBrands();
  if (last.fileName !== fileName || last.rowCount !== rows.length) return;
  for (const s of last.states) {
    if (typeof s.index !== "number" || s.index < 0 || s.index >= rows.length) continue;
    statuses.set(s.index, { status: s.status || "idle", message: s.message || "" });
  }
  const runStatus = document.getElementById("brands-run-status");
  if (runStatus && typeof last.done === "number" && typeof last.total === "number") {
    runStatus.textContent = `Finished: ${last.done}/${last.total} done.`;
  }
}

export function initBrands() {
  const input = document.getElementById("brands-file");
  const status = document.getElementById("brands-status");
  const table = document.getElementById("brands-table");
  if (!input) return;
  selectAll(store.getBrands().rows);
  restoreLastRun();
  paint();

  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const { headers, rows } = await parseCsv(file);
      store.setBrands({ fileName: file.name, headers, rows });
      selectAll(rows);
      resetStatuses();
      paint();
    } catch (err) {
      if (status) status.textContent = err && err.message ? err.message : String(err);
    } finally {
      input.value = "";
    }
  });

  if (table) {
    table.addEventListener("change", (e) => {
      const box = e.target && e.target.closest ? e.target.closest("[data-select-row]") : null;
      if (!box || running) return;
      const i = Number(box.getAttribute("data-select-row"));
      if (box.checked) selection.add(i);
      else selection.delete(i);
    });
  }

  const selectAllBtn = document.getElementById("brands-select-all");
  if (selectAllBtn) {
    selectAllBtn.addEventListener("click", () => {
      if (running) return;
      selectAll(store.getBrands().rows);
      paint();
    });
  }
  const deselectBtn = document.getElementById("brands-deselect-all");
  if (deselectBtn) {
    deselectBtn.addEventListener("click", () => {
      if (running) return;
      selection.clear();
      paint();
    });
  }

  const runBtn = document.getElementById("brands-run");
  const runStatus = document.getElementById("brands-run-status");
  if (runBtn) {
    runBtn.addEventListener("click", async () => {
      if (running) return;
      const { rows } = store.getBrands();
      const indices = [...selection].filter((i) => i >= 0 && i < rows.length).sort((a, b) => a - b);
      if (indices.length === 0) {
        if (runStatus) runStatus.textContent = "Select at least one row first.";
        return;
      }
      running = true;
      setRunUiEnabled(false);
      resetStatuses();
      if (runStatus) runStatus.textContent = `Running ${indices.length} row${indices.length === 1 ? "" : "s"}…`;
      try {
        const results = await runRows({
          rows,
          indices,
          templates: store.getTemplates(),
          config: store.getConfig(),
          onStatus: (index, st, message) => {
            statuses.set(index, { status: st, message: message || "" });
            paint();
          }
        });
        // Persist one entry per successful row (Unit 8). Subject/body are
        // already final — the runner applied the first-line split when the
        // block opted in, else subject is the template subject and body is
        // the AI reply (falling back to the substituted body).
        for (const r of results) {
          if (r.status !== "done") continue;
          store.addRun(
            makeRunEntry({
              brandName: r.brandName,
              emailSequence: r.emailSequence,
              subject: r.subject,
              body: r.body
            })
          );
        }
        refreshRuns();
        // Persist the summary so a reload still shows what happened —
        // per-row pills + the Finished line are otherwise session-only.
        store.setLastRun({
          at: Date.now(),
          fileName: store.getBrands().fileName,
          rowCount: rows.length,
          total: indices.length,
          done: results.filter((r) => r.status === "done").length,
          states: results.map((r) => ({ index: r.index, status: r.status, message: r.message || "" }))
        });
      } finally {
        running = false;
        setRunUiEnabled(true);
        if (runStatus) {
          const done = indices.filter((i) => statusFor(i).status === "done").length;
          runStatus.textContent = `Finished: ${done}/${indices.length} done.`;
        }
      }
    });
  }
}
