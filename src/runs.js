// src/runs.js — Runs tab: per-row output entries, copy buttons, clear all.
// Entries persist in store.js ("runs"); newest renders first. No AI calls,
// no placeholder logic.

import { store } from "./store.js";

let uidCounter = 0;

export function makeRunEntry({ brandName, emailSequence, subject, body }) {
  uidCounter += 1;
  return {
    id: `${Date.now().toString(36)}-${uidCounter}`,
    timestamp: Date.now(),
    brandName: brandName || "",
    emailSequence: emailSequence || "",
    subject: subject || "",
    body: body || ""
  };
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function entryHtml(entry) {
  const when = new Date(entry.timestamp).toLocaleString();
  return (
    `<article class="rounded border border-slate-200 p-4" data-run-id="${escapeHtml(entry.id)}">` +
    `<div class="mb-1 flex flex-wrap items-baseline gap-x-3">` +
    `<h3 class="font-semibold">${escapeHtml(entry.brandName || "(no name)")}</h3>` +
    (entry.emailSequence !== ""
      ? `<span class="text-xs text-slate-500">Sequence: ${escapeHtml(entry.emailSequence)}</span>`
      : "") +
    `<span class="ml-auto text-xs text-slate-400">${escapeHtml(when)}</span>` +
    `</div>` +
    `<div class="mt-2"><div class="mb-1 flex items-center justify-between">` +
    `<span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</span>` +
    `<button type="button" data-copy="subject" class="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100">Copy</button>` +
    `</div><p class="whitespace-pre-wrap text-sm" data-text="subject">${escapeHtml(entry.subject)}</p></div>` +
    `<div class="mt-2"><div class="mb-1 flex items-center justify-between">` +
    `<span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Body</span>` +
    `<button type="button" data-copy="body" class="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100">Copy</button>` +
    `</div><p class="whitespace-pre-wrap text-sm" data-text="body">${escapeHtml(entry.body)}</p></div>` +
    `</article>`
  );
}

export function renderRuns() {
  const list = document.getElementById("runs-list");
  if (!list) return;
  const entries = store.getRuns().slice().reverse(); // newest first
  list.innerHTML =
    entries.length === 0
      ? '<p class="text-sm text-slate-500">No runs yet. Select rows on the Brands tab and press Run.</p>'
      : entries.map(entryHtml).join("");
}

export function refreshRuns() {
  renderRuns();
}

function toast(text) {
  const el = document.createElement("div");
  el.textContent = text;
  el.setAttribute("role", "status");
  el.className =
    "fixed bottom-4 left-1/2 -translate-x-1/2 rounded bg-slate-900 px-4 py-2 text-sm text-white shadow";
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 1500);
}

async function copyEntryText(runId, field) {
  const entry = store.getRuns().find((e) => e.id === runId);
  if (!entry) return;
  const text = field === "subject" ? entry.subject : entry.body;
  try {
    await navigator.clipboard.writeText(text);
    toast(`Copied ${field}.`);
  } catch {
    toast("Copy failed — select the text manually.");
  }
}

export function initRuns() {
  renderRuns();
  const list = document.getElementById("runs-list");
  if (list) {
    list.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("[data-copy]") : null;
      if (!btn) return;
      const article = btn.closest("[data-run-id]");
      if (!article) return;
      copyEntryText(article.getAttribute("data-run-id"), btn.getAttribute("data-copy"));
    });
  }
  const clearBtn = document.getElementById("runs-clear");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      store.clearRuns();
      renderRuns();
      toast("All runs cleared.");
    });
  }
}
