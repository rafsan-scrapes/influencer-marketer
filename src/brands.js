// src/brands.js — Brands tab: CSV upload + rows table, plus header chips
// at the top of the Email Template tab. No AI calls, no placeholder logic.
// Loaded CSV persists via store.js ("brands"); uploading replaces it and
// never touches runs.

import { store } from "./store.js";
import { parseCsv } from "./csv.js";

export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Pure HTML builders (DOM-free, unit-testable).
export function renderBrandsTable(headers, rows) {
  if (!headers || headers.length === 0) {
    return '<p class="text-sm text-slate-500">No CSV loaded yet.</p>';
  }
  const head = headers.map((h) => `<th class="border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(h)}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr class="border-b last:border-0 hover:bg-slate-50">${headers
          .map((h) => `<td class="px-3 py-2 text-sm">${escapeHtml(row[h])}</td>`)
          .join("")}</tr>`
    )
    .join("");
  return (
    `<div class="overflow-x-auto"><table class="w-full border-collapse">` +
    `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
  );
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

function paint() {
  const { fileName, headers, rows } = store.getBrands();
  const status = document.getElementById("brands-status");
  const table = document.getElementById("brands-table");
  const chips = document.getElementById("template-chips");
  if (status) {
    status.textContent =
      headers.length === 0 ? "" : `${rows.length} row${rows.length === 1 ? "" : "s"} from ${fileName}`;
  }
  if (table) table.innerHTML = renderBrandsTable(headers, rows);
  if (chips) chips.innerHTML = renderHeaderChips(headers);
}

export function initBrands() {
  const input = document.getElementById("brands-file");
  const status = document.getElementById("brands-status");
  if (!input) return;
  paint();
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const { headers, rows } = await parseCsv(file);
      store.setBrands({ fileName: file.name, headers, rows });
      paint();
    } catch (err) {
      if (status) status.textContent = err && err.message ? err.message : String(err);
    } finally {
      input.value = "";
    }
  });
}
