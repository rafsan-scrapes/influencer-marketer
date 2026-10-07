# Influencer Marketer

## Overview

Influencer Marketer is a browser-based outreach tool for running personalised email campaigns to brands. The user uploads a CSV of brands, configures email templates with `[Column Name]` placeholders and optional if-conditions, selects which rows to run, and an AI model (via the Bynara router, OpenAI-compatible) fills the templates using each row's values. The output — a copy-pasteable Subject and Body per row — is saved to a Runs tab. Phase 1 generates emails only; it does not send them.

## Goals

1. Turn an uploaded brand CSV into ready-to-copy Subject + Body pairs for every selected row, in one sequential run, with no manual per-brand writing.
2. Give the user full control over templates: one set of default Subject / Body / Prompt boxes plus any number of if-condition overrides, all with click-to-insert placeholder chips.
3. Make placeholder resolution predictable: every `[Column Name]` resolves from the CSV header row; an empty cell for any placeholder used in that row stops generation for that row with a clear error.
4. Run entirely in the browser (no backend, no auth, no database) with config, templates, and run history persisted in localStorage.

## Core User Flow

1. Open the **AI Config** tab → enter Bynara API key (`sk-nry-…`) and model alias (e.g. `deepseek-v4-flash`) → press **Test Connection**.
2. Open the **Email Template** tab → fill in the default Subject, Body, and Prompt boxes → optionally add one or more if-conditions, each with its own Subject, Body, and Prompt boxes.
3. Upload a CSV on the **Brands** tab → the app reads all headers and shows rows in a table.
4. Select rows via checkboxes (or Select All) → press **Run**.
5. The app processes rows one at a time: evaluates conditions against each row's CSV values → picks the matching Subject / Body / Prompt (or the default if none match) → substitutes all `[Column Name]` placeholders → sends the filled template to the AI.
6. The AI receives the fully substituted Subject and Body (placeholders already filled) plus the substituted Prompt as its instruction, and returns the completed email.
7. Each result (brand name, subject, body) is saved to the **Runs** tab as its own entry with copy buttons. Errors (empty cell, API failure) are shown inline on the row.

## Features

### AI Config Tab

- **API key**: password field, stored in localStorage, never logged or displayed in plain text. Bynara keys start with `sk-nry-`.
- **Model**: free-text field (no dropdown); user types the model alias per Bynara docs (e.g. `deepseek-v4-flash`, or `combo/<name>` for fallback combos).
- **Endpoint**: override field for the Bynara router base URL; defaults to `https://router.bynara.id/v1`. In dev, `/bynara-api` routes through the Vite proxy to avoid CORS blocks.
- **Test Connection**: fires a cheap request to verify the key, model, and endpoint; surfaces auth, CORS, and network errors specifically.
- All config persists in localStorage.

### Email Template Tab

This is the single tab where all template authoring happens.

**Layout — top section: Column header chips**
All CSV column headers are shown as clickable chips at the top. Clicking a chip inserts `[Column Name]` at the cursor position in whichever Subject, Body, or Prompt box is focused.

**Default block (always present)**
- Subject input
- Body textarea
- Prompt textarea (optional — if left empty, the AI receives only the filled Subject and Body)

**If-condition blocks (added by the user)**
Each condition block contains:
- One or more condition rows, each: `[Column]` `[operator]` `[value]` — operators are `equals`, `contains`, `is empty`.
- Multiple condition rows within one block are joined by AND.
- Its own Subject, Body, and Prompt boxes (same structure as the default block).
- A delete button.
- Condition blocks can be reordered (drag or up/down arrows).

**Evaluation logic (per row at run time)**
1. Condition blocks are checked top to bottom.
2. The first block whose entire AND-condition evaluates to true against the row's CSV values is used.
3. If no condition matches, the default block is used.
4. If the matched block's Subject and Body are both empty, the row is skipped (no AI call).
5. If any `[Column Name]` placeholder in the selected Subject, Body, or Prompt resolves to an empty CSV cell, generation stops for that row with the error: `"[Column Name] is empty in CSV for this row"`.

**Prompt construction sent to the AI**
The app substitutes all placeholders in the selected Subject, Body, and Prompt first, then sends:
- System context (fixed outreach-assistant role, brevity/accuracy rules).
- The substituted Subject template and Body template as the content to complete.
- The substituted Prompt as the specific instruction for what the AI must generate or fill in.

The AI's job is narrow: fill only the spans or fields the Prompt instructs. The rest of the Subject and Body is already complete and must be preserved verbatim.

### Brands Tab

- **CSV upload**: parsed entirely in the browser (PapaParse). The file never leaves the browser except as text in the AI prompt.
- **Rows table**: one row per brand, columns derived from the CSV. Shows all column values.
- **Row selection**: checkbox per row, Select All / Deselect All.
- **Run button**: processes selected rows one at a time (sequential, not concurrent).
- **Per-row status**: idle → generating → done / error / skipped.
- **Error display**: shown inline on the row — e.g. `"[Latest Video Sponsored] is empty in CSV for this row"`.
- Uploading a new CSV replaces the current table but does not clear Runs.

### Runs Tab

- Every successfully generated row is saved as an individual entry.
- Each entry shows: brand name (from CSV), the email sequence value used (from the `[email_sequence]` column), Subject with a Copy button, Body with a Copy button, and the timestamp.
- Entries persist in localStorage until the user presses **Clear All Runs**.
- Entries are shown newest first.

## Placeholder System

- Syntax: `[Column Name]` — exact CSV header name, case-insensitive.
- Source: CSV row values only. No computed or automatic values.
- **Reserved tokens in the Prompt box**: `[Subject]` and `[Body]` expand to the selected block's already-filled Subject and Body (case-insensitive, verbatim even when empty). All other tokens must be CSV columns.
- `[email_sequence]` is a regular CSV column (user-filled before upload) and is treated identically to any other column. Its value determines which email in the sequence this row is sending.
- Insertion: clicking a column chip in the template editor inserts the placeholder at the cursor position in the focused input.
- Validation at run time: if any placeholder used in the selected Subject, Body, or Prompt resolves to an empty string, generation is blocked for that row with a specific error message. No silent substitution of empty strings.
- **First-line subject split (per-block opt-in checkbox)**: when enabled, the AI is expected to return the final subject on the first non-empty line; the app saves that line as Subject (stripping a leading `Subject:` label) and the rest as Body.

## Scope

### In Scope

- AI Config tab: Bynara router integration via browser `fetch` (OpenAI-compatible `/v1/chat/completions`; Bearer `sk-nry-…` key).
- Email Template tab: default block, if-condition blocks, column chips, condition evaluation.
- Brands tab: CSV upload, row table, checkbox selection, sequential run, per-row status and errors.
- Runs tab: per-row output entries, copy buttons, clear all.
- localStorage persistence for all config, templates, and run history.
- Vite + vanilla JavaScript + Tailwind CSS, static site.

### Out of Scope

- Sending emails (SMTP, Gmail API, any mailbox integration).
- Influencers tab (Phase 2 — tab shown but disabled).
- Reply detection, tracking, scheduling, automatic sequence advancement.
- Backend, database, user accounts, authentication.
- Async / concurrent AI requests.
- CSV export of results.
- A proxy server (Phase 1.1 only if CORS blocks browser-direct calls).

## Success Criteria

1. Test Connection returns a clear success or a specific failure reason (auth / CORS / network).
2. Uploading a CSV populates the header chips and the rows table correctly.
3. A row whose `[email_sequence]` column matches a condition block uses that block's Subject / Body / Prompt; a row with no match uses the default.
4. All `[Column Name]` placeholders in the selected block are substituted before the prompt is sent; the AI receives no raw bracket syntax.
5. A row with an empty cell for any used placeholder shows the correct error and is not sent to the AI.
6. A row where the selected block's Subject and Body are both empty is skipped with no API call.
7. Each completed row appears in the Runs tab as its own entry with working copy buttons.
8. Run history survives a page reload; Clear All Runs removes all entries.
9. Uploading a new CSV does not clear existing runs.
10. `npm run build` passes.