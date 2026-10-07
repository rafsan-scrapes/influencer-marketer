// src/runner.test.js — Unit 7 verification. Run with `npm test`.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runRows, brandNameFor, emailSequenceFor, findColumn } from "./runner.js";
import { renderBrandsTable, renderStatus } from "./brands.js";

const ROWS = [
  { Name: "Clay", "Email Sequence": "1", Category: "AI" },
  { Name: "Qlik", "Email Sequence": "", Category: "AI" },
  { Name: "Acme", "Email Sequence": "2", Category: "AI" }
];

const TEMPLATES = {
  default: {
    subject: "Hi [Name]",
    body: "Step [Email Sequence] for [Name].",
    prompt: "Personalise it."
  },
  conditions: []
};

const CONFIG = { apiKey: "k", model: "m", endpoint: "http://srv" };

function mockFetchOk(calls) {
  globalThis.fetch = async (url, opts) => {
    calls.push(JSON.parse(opts.body).messages);
    return { ok: true, json: async () => ({ choices: [{ message: { content: "generated!" } }] }) };
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("runRows", () => {
  it("row with empty placeholder cell errors, others complete (sequential)", async () => {
    const calls = [];
    mockFetchOk(calls);
    const seen = [];
    const results = await runRows({
      rows: ROWS,
      indices: [0, 1, 2],
      templates: TEMPLATES,
      config: CONFIG,
      onStatus: (i, st) => seen.push([i, st])
    });
    expect(results.map((r) => r.status)).toEqual(["done", "error", "done"]);
    expect(results[1].message).toBe("[Email Sequence] is empty in CSV for this row");
    // Sequential: exactly 2 API calls (failed row never sent), in order.
    expect(calls).toHaveLength(2);
    expect(calls[0][1].content).toContain("Hi Clay");
    expect(calls[1][1].content).toContain("Hi Acme");
    // Live status transitions in order.
    expect(seen).toEqual([
      [0, "generating"], [0, "done"],
      [1, "generating"], [1, "error"],
      [2, "generating"], [2, "done"]
    ]);
  });

  it("skips when Subject + Body are both empty (no AI call)", async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return { ok: true, json: async () => ({}) };
    };
    const results = await runRows({
      rows: ROWS,
      indices: [0],
      templates: { default: { subject: "", body: "   ", prompt: "x" }, conditions: [] },
      config: CONFIG
    });
    expect(results[0].status).toBe("skipped");
    expect(called).toBe(false);
  });

  it("API failure marks the row error with the message", async () => {
    globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => "bad key" });
    const results = await runRows({ rows: ROWS, indices: [0], templates: TEMPLATES, config: CONFIG });
    expect(results[0].status).toBe("error");
    expect(results[0].message).toContain("Authentication failed");
  });

  it("done results carry brand/sequence/subject/body", async () => {
    mockFetchOk([]);
    const results = await runRows({ rows: ROWS, indices: [2], templates: TEMPLATES, config: CONFIG });
    expect(results[0]).toMatchObject({
      status: "done",
      brandName: "Acme",
      emailSequence: "2",
      subject: "Hi Acme",
      content: "generated!"
    });
  });

  it("prompt may reference [Subject]/[Body] (user's exact pattern)", async () => {
    const calls = [];
    mockFetchOk(calls);
    const templates = {
      default: {
        subject: "[First Name], lets run it back",
        body: "Hey [First Name], loved the integration.",
        prompt: "The following is an email:\n[Subject]\n[Body]\nFill the span."
      },
      conditions: []
    };
    const rows = [{ "First Name": "Bob", Name: "X", "Email Sequence": "1" }];
    const results = await runRows({ rows, indices: [0], templates, config: CONFIG });
    expect(results[0].status).toBe("done");
    expect(calls[0][1].content).toContain("Bob, lets run it back");
  });

  it("subjectFromFirstLine splits AI reply into subject + body", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Hey Bob, quick idea\n\nHey Bob, loved the video." } }] })
    });
    const templates = {
      default: { subject: "Hi [Name]", body: "Yo [Name]", prompt: "Go.", subjectFromFirstLine: true },
      conditions: []
    };
    const results = await runRows({ rows: ROWS, indices: [0], templates, config: CONFIG });
    expect(results[0]).toMatchObject({
      status: "done",
      subject: "Hey Bob, quick idea",
      body: "Hey Bob, loved the video."
    });
  });

  it("subjectFromFirstLine off keeps template subject, AI reply as body", async () => {
    mockFetchOk([]);
    const results = await runRows({ rows: ROWS, indices: [0], templates: TEMPLATES, config: CONFIG });
    expect(results[0]).toMatchObject({ subject: "Hi Clay", body: "generated!" });
  });
});

describe("column helpers", () => {
  it("brandNameFor prefers Name, falls back to first column", () => {
    expect(brandNameFor(ROWS[0])).toBe("Clay");
    expect(brandNameFor({ Foo: "x" })).toBe("x");
    expect(brandNameFor({})).toBe("");
  });
  it("emailSequenceFor matches both spellings", () => {
    expect(emailSequenceFor(ROWS[0])).toBe("1");
    expect(emailSequenceFor({ email_sequence: "3" })).toBe("3");
    expect(emailSequenceFor({ Other: "x" })).toBe("");
  });
  it("findColumn is case-insensitive", () => {
    expect(findColumn({ NAME: "x" }, ["name"])).toBe("NAME");
  });
});

describe("table selection/status rendering", () => {
  const headers = ["Name", "Email Sequence"];
  it("renders checkboxes and status pills when opts given", () => {
    const html = renderBrandsTable(headers, ROWS.slice(0, 2), {
      selection: new Set([0]),
      statuses: new Map([[1, { status: "error", message: "[Email Sequence] is empty in CSV for this row" }]])
    });
    expect(html).toContain('data-select-row="0" checked');
    expect(html).toContain('data-select-row="1"');
    expect(html).toContain("error");
    expect(html).toContain("[Email Sequence] is empty in CSV for this row");
  });
  it("plain table without opts (backwards compatible)", () => {
    const html = renderBrandsTable(headers, ROWS.slice(0, 1));
    expect(html).not.toContain("checkbox");
    expect(html).not.toContain("Status");
  });
  it("renderStatus escapes messages", () => {
    expect(renderStatus({ status: "error", message: "<b>x</b>" })).not.toContain("<b>");
  });
});
