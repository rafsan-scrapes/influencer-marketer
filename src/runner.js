// src/runner.js — sequential run pipeline. No DOM.
// Iterates selected row indices one at a time: evaluate conditions ->
// substitute placeholders -> build prompt -> api.sendMessage.
// Reports live status via onStatus(index, status, message).
// Run entries are NOT persisted here (Unit 8 owns the runs store);
// per-row results are returned for the caller to save.

import { evaluateConditions, buildPromptPayload, splitFirstLine } from "./templates.js";
import { sendMessage } from "./api.js";

export const STATUSES = ["idle", "generating", "done", "error", "skipped"];

// First header (case-insensitive) matching one of the candidates.
export function findColumn(row, candidates) {
  const lower = candidates.map((c) => c.toLowerCase());
  for (const key of Object.keys(row || {})) {
    if (lower.includes(key.toLowerCase())) return key;
  }
  return null;
}

export function brandNameFor(row) {
  const keys = Object.keys(row || {});
  if (keys.length === 0) return "";
  const found = findColumn(row, ["brand", "brand name", "name", "company"]);
  const v = row[found || keys[0]];
  return v == null ? "" : String(v);
}

export function emailSequenceFor(row) {
  const found = findColumn(row, ["email_sequence", "email sequence", "emailsequence"]);
  if (!found) return "";
  const v = row[found];
  return v == null ? "" : String(v);
}

export async function runRows({ rows, indices, templates, config, onStatus }) {
  const notify = typeof onStatus === "function" ? onStatus : () => {};
  const results = [];
  for (const index of indices) {
    const row = rows[index];
    notify(index, "generating", "");
    try {
      const block = evaluateConditions(templates.conditions, row, templates.default);
      // Throws "[Column] is empty in CSV for this row" on any empty cell.
      // [Subject]/[Body] inside the prompt resolve to the filled template.
      const { system, userContent, subject, body } = buildPromptPayload(block, row);
      if (subject.trim() === "" && body.trim() === "") {
        notify(index, "skipped", "Subject and Body are both empty — no AI call made.");
        results.push({ index, status: "skipped", message: "Subject and Body are both empty." });
        continue;
      }
      const res = await sendMessage({
        endpoint: config.endpoint,
        apiKey: config.apiKey,
        model: config.model,
        system,
        userContent
      });
      if (!res.ok) {
        notify(index, "error", res.message);
        results.push({ index, status: "error", message: res.message });
        continue;
      }
      notify(index, "done", "");
      // Per-block opt-in: AI returns the final subject on the first line.
      // Otherwise the template subject stands and the AI reply is the body
      // (falling back to the substituted body when the model says nothing).
      const content = res.content;
      let finalSubject = subject;
      let finalBody = content && content.trim() !== "" ? content : body;
      if (block.subjectFromFirstLine && content && content.trim() !== "") {
        const split = splitFirstLine(content);
        if (split.subject !== "") finalSubject = split.subject;
        finalBody = split.body !== "" ? split.body : body;
      }
      results.push({
        index,
        status: "done",
        brandName: brandNameFor(row),
        emailSequence: emailSequenceFor(row),
        subject: finalSubject,
        body: finalBody,
        content
      });
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      notify(index, "error", message);
      results.push({ index, status: "error", message });
    }
  }
  return results;
}
