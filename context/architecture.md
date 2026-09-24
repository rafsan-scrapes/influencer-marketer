# Architecture

## Stack

Vite + vanilla JS + Tailwind CSS (v3). No framework. Static site; `npm run build` outputs `dist/`.

## File Plan

| File | Owns | Must not |
|---|---|---|
| `index.html` | Tab shell: nav buttons + four panels (`ai-config`, `email-template`, `brands`, `runs`) + disabled Influencers button | No AI calls, no placeholder logic |
| `src/main.js` | Tab navigation (`showTab`); wires per-tab modules as they land | No `fetch` to AI, no `[Column]` substitution |
| `src/style.css` | Tailwind directives only | — |
| `src/store.js` (Unit 2) | localStorage wrapper: versioned keys, safe JSON, typed getters/setters | No DOM, no fetch |
| `src/api.js` (Unit 3) | Sole module allowed to call `fetch` for the AI (Bynara router `/v1/chat/completions`, OpenAI-compatible; maps `{ error: { type } }` envelope) | No DOM, no placeholder substitution |
| `src/aiConfig.js` (Unit 3) | AI Config tab DOM only (API key, model alias, endpoint); restores/persists form via store, Test Connection via api | No `fetch` directly, no placeholder logic |
| `src/csv.js` (Unit 4) | CSV parsing via PapaParse (`parseCsv`/`parseCsvText`, header/row normalization) | No AI calls |
| `src/brands.js` (Unit 4) | Brands tab DOM (upload, table, status) + Email Template header chips; reads/writes `brands` | No AI calls, no placeholder substitution |
| `src/templateEditor.js` (Unit 6) | Email Template tab DOM (chips, default block, condition blocks); state in `templates`, headers via `brands` + `im:headers-changed` | No `fetch`, no placeholder substitution |
| `src/runner.js` (Unit 7) | Sequential run pipeline (`runRows`, column helpers); statuses via callback, results returned in-memory | No DOM; persistence owned by Unit 8 |
| `src/runs.js` (Unit 8) | Runs tab DOM (newest-first entries, copy+toast, clear all); `makeRunEntry`, `refreshRuns` called by brands.js after each run | No `fetch`, no placeholder logic |
| `src/templates.js` (Unit 5) | Sole module for placeholder resolution: `extractPlaceholders`, `substitutePlaceholders`, `evaluateConditions`, `buildPromptPayload` | No `fetch`, no DOM |
| `src/test/sample.csv` | 2–3 row fixture trimmed from `reachingoutsofar.csv` (original untouched) | Never edited once created |

## localStorage Invariants

- Keys: `im_config.v1`, `im_templates.v1`, `im_runs.v1`, `im_brands.v1` (version suffix; bump `STORE_VERSION` to migrate). Versioned; safe JSON parse/stringify (corrupt data → default, never throw to UI).
- `im_config`: `{ apiKey, model, endpoint }` — populated only via AI Config tab. Default endpoint `https://router.bynara.id/v1` (Bynara router); dev proxy path `/bynara-api` supported.
- `im_templates`: `{ default: { subject, body, prompt }, conditions: ConditionBlock[] }`.
- `im_runs`: `RunEntry[]` — appended per successful row, newest-first at render; cleared only via Clear All Runs. New CSV upload must not clear runs.
- `im_brands`: `{ fileName, headers, rows }` — replaced wholesale on each CSV upload; restored on load so the table and chips survive reload.

## Data Shapes

```js
// ConditionBlock
{ id: string, conditions: [{ column: string, op: "equals"|"contains"|"isEmpty", value: string }], subject: string, body: string, prompt: string }
// DefaultBlock
{ subject: string, body: string, prompt: string }
// RunEntry
{ id: string, timestamp: number, brandName: string, emailSequence: string, subject: string, body: string }
```

## Hard Rules (from ai-workflow-rules.md)

- All AI calls through `src/api.js`; all placeholder resolution through `src/templates.js`.
- Prompt construction order: evaluate conditions → substitute placeholders → send (AI never sees raw `[Column]`).
- Empty cell for a used placeholder = hard error `"[Column Name] is empty in CSV for this row"`; never silent.
- Both Subject + Body empty after evaluation = skip row, no AI call.
- Rows processed sequentially with `await`; no `Promise.all`.
- API key field always `type="password"`; never logged or shown.
