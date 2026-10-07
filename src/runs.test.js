// @vitest-environment jsdom
// src/runs.test.js — Unit 8 verification. Run with `npm test`.

import { describe, it, expect, beforeEach } from "vitest";
import { store } from "./store.js";
import { makeRunEntry, renderRuns, initRuns } from "./runs.js";
import { initBrands } from "./brands.js";

const RUNS_PANEL = `
<section id="panel-runs">
  <button id="runs-clear" type="button">Clear All Runs</button>
  <div id="runs-list"></div>
</section>`;

const BRANDS_PANEL = `
<section id="panel-brands">
  <input id="brands-file" type="file" />
  <button id="brands-select-all" type="button">Select All</button>
  <button id="brands-deselect-all" type="button">Deselect All</button>
  <button id="brands-run" type="button">Run</button>
  <span id="brands-status"></span>
  <span id="brands-run-status"></span>
  <div id="brands-table"></div>
</section>
<section id="panel-email-template"><div id="template-chips"></div></section>`;

let clipboardText = null;

beforeEach(() => {
  window.localStorage.clear();
  clipboardText = null;
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: async (t) => { clipboardText = t; } },
    configurable: true
  });
  document.body.innerHTML = RUNS_PANEL;
  initRuns();
});

function seedRuns() {
  store.setRuns([
    { id: "old", timestamp: 1000, brandName: "Old", emailSequence: "1", subject: "s-old", body: "b-old" },
    { id: "new", timestamp: 2000, brandName: "New", emailSequence: "2", subject: "s-new", body: "b-new" }
  ]);
  renderRuns();
}

describe("makeRunEntry", () => {
  it("has the required shape", () => {
    const e = makeRunEntry({ brandName: "A", emailSequence: "1", subject: "s", body: "b" });
    expect(e).toMatchObject({ brandName: "A", emailSequence: "1", subject: "s", body: "b" });
    expect(typeof e.id).toBe("string");
    expect(typeof e.timestamp).toBe("number");
  });
});

describe("runs list", () => {
  it("renders newest first with sequence + timestamp", () => {
    seedRuns();
    const articles = [...document.querySelectorAll("[data-run-id]")];
    expect(articles.map((a) => a.getAttribute("data-run-id"))).toEqual(["new", "old"]);
    expect(document.body.textContent).toContain("Sequence: 2");
  });

  it("copy subject puts the exact text on the clipboard + toast", async () => {
    seedRuns();
    document.querySelector('[data-run-id="new"] [data-copy="subject"]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(clipboardText).toBe("s-new");
    expect(document.body.textContent).toContain("Copied subject.");
  });

  it("copy body puts the exact body text on the clipboard", async () => {
    seedRuns();
    document.querySelector('[data-run-id="old"] [data-copy="body"]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(clipboardText).toBe("b-old");
  });

  it("clear all empties UI and store (persists across re-render)", () => {
    seedRuns();
    document.getElementById("runs-clear").click();
    expect(document.querySelector("[data-run-id]")).toBe(null);
    expect(store.getRuns()).toEqual([]);
    renderRuns();
    expect(document.querySelector("[data-run-id]")).toBe(null);
  });
});

describe("run → runs integration", () => {
  it("2 successful rows create 2 entries, newest first", async () => {
    document.body.innerHTML = BRANDS_PANEL + RUNS_PANEL;
    store.setBrands({
      fileName: "t.csv",
      headers: ["Name", "Email Sequence"],
      rows: [
        { Name: "Clay", "Email Sequence": "1" },
        { Name: "Qlik", "Email Sequence": "" },
        { Name: "Acme", "Email Sequence": "2" }
      ]
    });
    store.setTemplates({
      default: { subject: "Hi [Name]", body: "Step [Email Sequence].", prompt: "Go." },
      conditions: []
    });
    store.setConfig({ apiKey: "k", model: "m", endpoint: "http://srv" });
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Done email!" } }] })
    });
    initBrands();
    initRuns();
    document.getElementById("brands-run").click();
    for (let i = 0; i < 50 && store.getRuns().length < 2; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    const runs = store.getRuns();
    expect(runs).toHaveLength(2);
    // Newest (Acme, ran last) renders first.
    const ids = [...document.querySelectorAll("#runs-list [data-run-id]")].map((a) =>
      a.getAttribute("data-run-id")
    );
    expect(ids).toEqual([runs[1].id, runs[0].id]);
    expect(runs[0]).toMatchObject({ brandName: "Clay", emailSequence: "1", subject: "Hi Clay", body: "Done email!" });
  });
});
