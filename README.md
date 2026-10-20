# Influencer Marketer

A browser-based outreach tool that turns a brand CSV into ready-to-copy, personalized outreach emails — one sequential AI-assisted run at a time.

> **Note:** This public repo is a preview. The full source code is private.

## What it does

Influencer Marketer generates personalized brand-outreach emails (Subject + Body) from a CSV upload:

1. **AI Config** — Enter your API key, model alias, and endpoint (Bynara router, OpenAI-compatible). Test the connection before running.
2. **Email Template** — Write one default Subject / Body / Prompt, plus optional if-condition blocks (e.g. different copy per `[email_sequence]` step). Click any CSV column chip to insert a `[Column Name]` placeholder at the cursor.
3. **Brands** — Upload a CSV of brands. Select rows with checkboxes, then press **Run** (AI) or **Run without AI** (template substitution only).
4. **Runs** — Every successful row is saved as its own entry (brand name, sequence value, Subject + Body with copy buttons, timestamp), newest first. History persists in `localStorage` until you clear it.

Key behaviors:

- Placeholders (`[Brand Name]`, `[Contact]`, etc.) resolve from CSV headers, case-insensitively.
- An empty CSV cell for any placeholder used in that row is a hard error — the row is flagged inline and never sent to the AI silently.
- Condition blocks are checked top to bottom; the first full AND-match wins, otherwise the default block is used.
- Rows run sequentially (one `await` at a time), with live `idle → generating → done / error / skipped` status per row.
- Everything runs client-side (Vite + vanilla JS + Tailwind). The CSV never leaves the browser except as text inside the AI prompt. No backend, no database, no accounts.

## How it can help influencer marketing agencies

- **Kill per-brand copywriting time:** write one template set with condition blocks per sequence step or segment, then generate dozens of personalized drafts in a single run.
- **Keep outreach consistent:** the AI only fills what the Prompt instructs; the rest of your Subject/Body is preserved verbatim, so tone and offer stay on-brand.
- **Segment without spreadsheets gymnastics:** `equals` / `contains` / `is empty` conditions with AND rows and block reordering replace manual per-segment drafts (e.g. cold vs. follow-up vs. warm intro).
- **Catch bad data before it sends:** empty-cell hard errors surface exactly which column is missing for which row, instead of shipping emails with blank names or links.
- **Stay copy-paste flexible:** Phase 1 generates text only — no mailbox integration — so any sender, sequencer, or CRM can be used downstream. Copy buttons make handoff fast.
- **Work safely with client lists:** local-only storage means brand lists stay in the operator's browser; nothing is uploaded to a third-party server besides the AI prompt itself.

## Why it's not production-ready yet

Honest status — Phase 1 (brand outreach generator) is feature-complete in code with 48 automated tests passing, but:

- **No live browser verification yet:** needs a manual pass with a real Bynara key (AI run + Run-without-AI on a fresh CSV, reload persistence, clipboard copy).
- **No sending:** it generates text only. No SMTP / Gmail API, no scheduling, no reply detection, no tracking, no automatic sequence advancement.
- **Single-user, single-browser:** config, templates, and runs live in `localStorage`. No multi-user, no shared workspace, no cloud sync, no auth.
- **No result export:** Runs can be copied one by one, but there is no CSV export of generated subjects/bodies.
- **Sequential only:** one AI call at a time by design (avoids rate limits), so large lists are slow.
- **CORS / endpoint fragility:** production calls the Bynara router directly from the browser; only dev uses a same-origin Vite proxy. Network, auth, and rate-limit errors are surfaced but not retried.
- **Influencers side missing:** Phase 2 (Influencers tab) is shown disabled. This is brands-only for now.

Do not use it for live client campaigns until the manual browser pass is done and you have reviewed error handling, key storage (browser `localStorage`), and AI output quality for your templates.

## Tech stack

- Vite + vanilla JavaScript + Tailwind CSS v3 (static site, `npm run build` → `dist/`)
- PapaParse for in-browser CSV parsing
- Vitest + jsdom for tests (`npm test`)
- Bynara router (`/v1/chat/completions`, OpenAI-compatible) via plain `fetch`

## Quick start (full source holders only)

```bash
npm install
npm run dev      # local dev (uses /bynara-api proxy to avoid CORS)
npm test         # automated tests
npm run build    # production build to dist/
npm run preview  # smoke-test the build
```

Ignored locally and never committed: `add_lead_columns.py`, `filter_leadlist.py`, and all `*.csv` lead lists.

---

## Get the actual code

The full source is private while the tool is being finished.

**Follow for release updates and access to the actual code:**

- Instagram: [\[Your Instagram URL here\]](https://www.instagram.com/rafsan_codes/)

Send me your LinkedIn / Instagram handle plus your agency name and I'll share access details.
