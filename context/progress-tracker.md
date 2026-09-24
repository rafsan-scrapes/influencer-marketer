# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

Unit 4

## Current Goal

Unit 4 — CSV Upload and Brands Table.

## Completed

- Product scope, UI layout, template/condition model, placeholder system, and run output model finalised in `project-overview.md`.
- Workflow rules finalised in `ai-workflow-rules.md`.
- Unit 1 — Scaffold done: Vite + vanilla JS + Tailwind v3 shell (`index.html`, `src/main.js` with `showTab`, `src/style.css`); four working tabs + disabled Influencers button; `context/architecture.md` created. Verify passed: tab wiring confirmed via source check (4 buttons toggle 4 panels, Influencers excluded/disabled); `npm run build` exits 0 and produces `dist/`.
- Unit 2 — Store done: `src/store.js` (versioned keys `im_<domain>.v1`, safe JSON, generic `get`/`set` + typed `getConfig`/`setConfig`, `getTemplates`/`setTemplates`, `getRuns`/`setRuns`/`addRun`/`clearRuns`); exposed as `window.store` in `src/main.js` for console use. Verify passed: node test with localStorage stub (roundtrip, reload persistence, corrupt/wrong-type JSON → default, unknown domain throws, addRun/clearRuns); `npm run build` exits 0.
- Unit 3 — AI Config done: `src/api.js` (only fetcher; `testConnection` + `sendMessage` against `/chat/completions`, errors classified as auth / not-found / rate-limit / http / network-with-CORS-note / config) and `src/aiConfig.js` (form restore on load, persist on input/change, Test Connection with busy/success/error status). Verify passed: 15 node assertions with stubbed fetch (URL resolution, bearer header, body shape, all error kinds, missing-key/model short-circuit); `npm run build` exits 0. Live key/model check and reload-restore still need a manual browser pass.

## In Progress

Nothing yet.

## Next Up

Build in this order. Each unit must pass its verification before the next begins.

### Unit 1 — Scaffold
Set up Vite + vanilla JS + Tailwind. Create the four top-level tabs (AI Config, Email Template, Brands, Runs — Influencers tab disabled/greyed). `npm run dev` serves a shell with working tab navigation. `npm run build` passes.

**Verify:** Tab clicks switch the visible panel. Build produces a `dist/` folder.

---

### Unit 2 — Store
Write `src/store.js`: a localStorage wrapper with versioned keys, safe JSON parse/stringify, and typed getters/setters for each domain (config, templates, runs). No UI.

**Verify:** Open browser console → `store.set('config', { apiKey: 'test' })` → reload → `store.get('config')` returns `{ apiKey: 'test' }`.

---

### Unit 3 — AI Config Tab
Build the AI Config tab UI and `src/api.js`. Fields: agent name, API key (password), model (free text), endpoint (with default). Test Connection button fires a request to the configured endpoint, surfaces success or specific errors (auth, CORS, network). All values persist via `store.js`.

**Verify:** Enter a valid key and model → Test Connection shows success. Enter a bad key → shows auth error. Reload → all fields restored.

---

### Unit 4 — CSV Upload and Brands Table
Build `src/csv.js` (PapaParse). CSV upload on the Brands tab parses headers and rows. Table renders all rows with all column values. Header chips appear at the top of the Email Template tab once a CSV is loaded. Uploading a second CSV replaces the table; does not clear runs.

**Verify:** Upload a 3-row CSV → table shows 3 rows with correct values. Upload a different CSV → table replaced. Runs tab entry count unchanged.

---

### Unit 5 — Template Engine (logic only, no UI)
Write `src/templates.js`:
- `extractPlaceholders(text)` → array of column names from `[Column Name]` tokens.
- `substitutePlaceholders(text, row)` → substituted string, or throws with the specific missing-column name if any used placeholder resolves to an empty string.
- `evaluateConditions(conditionBlocks, row)` → returns the first matching block (or the default block if none match).
- `buildPromptPayload(block, row, agentName)` → returns `{ system, userContent }` ready to pass to `src/api.js`.

No UI in this unit. Write inline tests using a hardcoded 2-row sample object.

**Verify:** Tests pass in the browser console or via a `src/templates.test.js` run with Vitest.

---

### Unit 6 — Email Template Tab UI
Build the Email Template tab:
- Column chips at the top (populated from loaded CSV headers; click inserts `[Column Name]` at cursor in the focused input).
- Default block: Subject input, Body textarea, Prompt textarea.
- "Add condition" button appends a condition block below the default: one or more condition rows (`[column chip] [op dropdown] [value input]`), Subject, Body, Prompt. AND badge between rows. Delete button. Up/down reorder buttons.
- All template state (default block content, all condition blocks) persists via `store.js`.

**Verify:** Type into Subject → reload → content restored. Add a condition block → reload → block restored with its values. Click a chip → `[Column Name]` inserted at cursor.

---

### Unit 7 — Row Selection and Sequential Run
On the Brands tab: add a checkbox column, Select All / Deselect All. Add a Run button. On Run, iterate selected rows sequentially (one at a time, await each): call `evaluateConditions` → `substitutePlaceholders` (block on error, mark row as error with message) → `buildPromptPayload` → `api.sendMessage`. Per-row status indicator: idle / generating / done / error / skipped. Skipped when selected block Subject + Body are both empty.

**Verify:** 3-row CSV, row 2 has an empty cell that a placeholder needs → row 1 completes, row 2 shows error with column name, row 3 completes. Status updates are visible live.

---

### Unit 8 — Runs Tab
After each successful row generation, save an entry to `store.js` runs array: `{ id, timestamp, brandName, emailSequence, subject, body }`. Runs tab renders entries newest-first. Each entry shows brand name, `[email_sequence]` column value, Subject with Copy button, Body with Copy button, timestamp. Copy buttons use `navigator.clipboard`, show a brief toast. Clear All Runs button empties the array and the UI.

**Verify:** Run 2 rows → Runs tab shows 2 entries newest-first. Copy Subject → clipboard has the exact text. Clear All Runs → tab empty. Reload → still empty.

---

### Unit 9 — Persistence Verification and Build Pass
Reload the app after: config saved, template with 2 condition blocks saved, a CSV loaded, a run completed. Confirm everything restores correctly. Confirm `npm run build` produces a clean `dist/` with no warnings relevant to the app code. Smoke-test the built files via `npm run preview`.

**Verify:** All state restored on reload. `npm run build` exits 0.

---

## Open Questions

- None currently. All product decisions resolved.

## Architecture Decisions

| Decision | Rationale |
|---|---|
| Vite + vanilla JS + Tailwind (not a single HTML file) | Build step was explicitly chosen; enables modules and Tailwind purging while still deploying as a static site. |
| No backend in Phase 1 | Scope constraint; everything in localStorage. CSV never leaves the browser except as prompt text to the AI endpoint. |
| `/chat/completions` (OpenAI-compatible) | Only endpoint that works with plain `fetch` and no SDK; uniform across models. |
| `src/api.js` behind an interface | Lets a proxy replace direct calls in Phase 1.1 without touching the UI. |
| Model as free-text field | User consults OpenCode Go docs for model names; no stale hardcoded list. |
| Placeholders are `[Column Name]`, case-insensitive, from CSV headers | Predictable; chips in the UI make insertion exact. |
| Empty cell = hard error, not silent substitution | User-filled CSVs are expected to be complete for the columns a template uses; a silent empty string produces a bad email silently. |
| `[email_sequence]` is a plain CSV column | User controls which email step each row is on before uploading; treated identically to any other column. |
| Conditions: AND-only, operators: equals / contains / is empty, no nesting | Simple enough to build and verify; OR is modelled as a second condition block (first match wins). |
| Default block is the fallback | Conditions checked top to bottom; default used only if none match. Both Subject and Body empty = skip row. |
| Sequential (non-concurrent) AI calls | Avoids rate-limit complexity; acceptable for a single-user tool. |
| One Runs entry per row | Each brand is an independent unit of work; per-row entries are easier to copy from than batches. |
| Runs persist until manually cleared | User may need results across sessions; explicit Clear All gives control. |
| Phase 1.1: minimal Node proxy if CORS blocks | UI unchanged; `src/api.js` interface swaps the fetch target only. |

## Session Notes

- No code exists yet.
- Data shape for a condition block:
  ```js
  {
    id: string,
    conditions: [{ column: string, op: 'equals'|'contains'|'isEmpty', value: string }],
    subject: string,
    body: string,
    prompt: string
  }
  ```
- Data shape for the default block (same minus `conditions`):
  ```js
  { subject: string, body: string, prompt: string }
  ```
- localStorage key plan (to be formalised in `architecture.md`):
  - `im_config` — AI Config values
  - `im_templates` — `{ default: Block, conditions: ConditionBlock[] }`
  - `im_runs` — `RunEntry[]`
- `architecture.md` does not exist yet; create it during or before Unit 1 to define module boundaries and localStorage invariants.
- Sample test data: trim `reachingoutsofar.csv` to 2–3 rows and commit as `src/test/sample.csv`. Do not edit the original.