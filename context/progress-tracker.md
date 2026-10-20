# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

**Phase 2: Frontend Integration** — Unit 8 (Project Switcher UI & API Client)

## Current Goal

Build frontend integration: API client, project switcher, and project-aware tab routing.

## Completed

- Product scope, UI layout, template/condition model, placeholder system, and run output model finalised in `project-overview.md`.
- Workflow rules finalised in `ai-workflow-rules.md`.
- Architecture decisions, module boundaries, database schema, API contracts documented in `architecture.md`.

## In Progress

### Phase 1: Backend Foundation (Units 1–8) — **COMPLETE**

#### Unit 1 — Express + pg Setup, Railway Config, Health Check
- [x] Create `backend/` folder with `package.json`
- [x] Install dependencies: `express`, `pg`, `cors`, `dotenv`, `zod`
- [x] Create `src/db.js` with pg Pool and migration runner
- [x] Create `src/migrations/001_init.sql` with full schema
- [x] Create `src/index.js` with Express app, CORS, JSON parser, error handler
- [x] Add health check endpoint `GET /health`
- [x] Create `Dockerfile` for backend
- [x] Create `railway.toml` with backend service
- [x] Add `npm run dev`, `npm run start`, `npm run migrate` scripts

**Verify:** `npm run dev` starts server on port 3000; `GET /health` returns `{ status: "ok" }`; `npm run migrate` creates tables in local PostgreSQL.

---

#### Unit 2 — Project CRUD API
- [x] Create `src/routes/projects.js` with GET/POST/PATCH/DELETE `/api/projects`
- [x] Mount routes in `index.js`
- [x] Add Zod validation for request bodies
- [x] Return consistent JSON shape with `updated_at` timestamps

**Verify:** `curl` tests: create project → list projects → update name → delete project → list empty.

---

#### Unit 3 — Sequence CRUD API
- [x] Create `src/routes/sequences.js` with GET/POST/PATCH/DELETE `/api/projects/:projectId/sequences`
- [x] Add reorder endpoint `POST /api/projects/:projectId/sequences/reorder`
- [x] Enforce unique `step_order` per project
- [x] Cascade delete sequences when project deleted (via FK)

**Verify:** Create project → add 3 sequences → reorder → update name → delete sequence → delete project (cascades).

---

#### Unit 4 — Template & Condition CRUD API
- [x] Create `src/routes/templates.js` with GET/POST/PATCH/DELETE `/api/sequences/:sequenceId/templates`
- [x] Create condition endpoints: POST/PATCH/DELETE `/api/templates/:templateId/conditions`, `/api/conditions/:id`
- [x] Enforce only ONE default template per sequence (partial unique index)
- [x] Return templates with nested conditions array

**Verify:** Create sequence → add default template → add 2 condition templates → add conditions to each → fetch all → update → delete.

---

#### Unit 5 — Contact/CSV Import API
- [x] Create `src/services/csvImport.js` for validation and bulk insert
- [x] Create `src/routes/contacts.js` with:
  - `POST /api/projects/:projectId/contacts/import` (bulk insert from CSV rows)
  - `GET /api/projects/:projectId/contacts`
  - `PATCH /api/contacts/:id/sequence-step`
- [x] Store all CSV columns in `csv_data` JSONB
- [x] Extract `email` column (required) for contact email field

**Verify:** Import 5-row CSV → verify contacts table → update sequence step per contact → fetch contacts.

---

#### Unit 6 — Generated Emails API
- [x] Create `src/routes/generated.js` with:
  - `GET /api/projects/:projectId/generated-emails?sequenceId=`
  - `DELETE /api/generated-emails/:id`
- [x] Support filtering by status, contact

**Verify:** Manually insert generated_emails rows → fetch by sequence → delete one → verify.

---

#### Unit 7 — Gemini Proxy Endpoint
- [x] Create `src/services/gemini.js` with `generateContent()` function
- [x] Create `src/routes/ai.js` with `POST /api/ai/generate`
- [x] Accept: `{ model, temperature, systemPrompt, userPrompt }`
- [x] Call Google Gemini REST API with `GEMINI_API_KEY` from env
- [x] Return `{ content: string }` or error

**Verify:** Set `GEMINI_API_KEY` → call endpoint with test prompt → returns generated text.

---

#### Unit 8 — Generation Pipeline API
- [x] Create `src/services/templateEngine.js` (mirrors frontend logic)
- [x] Create `src/routes/generation.js` with `POST /api/projects/:projectId/generate`
- [x] Sequential processing: evaluate conditions → substitute placeholders → call Gemini → save results
- [x] Handle skipped (empty subject+body), errors, AI failures

**Verify:** Create project → sequences → templates → contacts → call generate endpoint → results saved to generated_emails.

---

### Phase 2: Frontend Integration (Units 8–13)

#### Unit 8 — Project Switcher UI & API Client
- [ ] Create `frontend/src/api.js` with fetch wrappers for all endpoints
- [ ] Create `frontend/src/store.js` (UI prefs only: theme, lastProjectId)
- [ ] Create `frontend/src/projects.js` with project list, create, switch, delete UI
- [ ] Update `frontend/src/main.js` for project-aware tab routing
- [ ] Persist last selected project in localStorage

**Verify:** Create 2 projects → switch between them → reload → last project restored.

### Phase 2: Frontend Integration (Units 8–13)

#### Unit 8 — Project Switcher UI & API Client
- [ ] Create `frontend/src/api.js` with fetch wrappers for all endpoints
- [ ] Create `frontend/src/store.js` (UI prefs only: theme, lastProjectId)
- [ ] Create `frontend/src/projects.js` with project list, create, switch, delete UI
- [ ] Update `frontend/src/main.js` for project-aware tab routing
- [ ] Persist last selected project in localStorage

**Verify:** Create 2 projects → switch between them → reload → last project restored.

---

#### Unit 9 — Sequence Manager UI
- [ ] Create `frontend/src/sequences.js` with sequence list per project
- [ ] Add sequence: name input, add button
- [ ] Reorder: drag-and-drop or up/down buttons
- [ ] Delete sequence with confirmation
- [ ] Call sequence API endpoints

**Verify:** In project → add 3 sequences → reorder → delete middle → verify order.

---

#### Unit 10 — Template Editor per Sequence
- [ ] Adapt `frontend/src/templateEditor.js` for per-sequence context
- [ ] Sequence selector (tabs or dropdown) to switch template editor context
- [ ] Default block: Subject, Body, Prompt, AI toggle, model select, temperature, first-line-split
- [ ] Condition blocks: add/delete/reorder, AND-joined condition rows
- [ ] AI config per block (use_ai, model, temperature)
- [ ] Column chips from loaded CSV headers
- [ ] Persist templates via API (not localStorage)

**Verify:** Select sequence → add default template → add condition block → add conditions → switch sequence → templates isolated.

---

#### Unit 11 — Contacts Table with Sequence Step Dropdown
- [ ] Create `frontend/src/contacts.js` (replaces `brands.js`)
- [ ] CSV upload with PapaParse (client-side preview)
- [ ] Send to backend `/contacts/import` on confirm
- [ ] Contacts table: all CSV columns + **Current Sequence Step dropdown** per row
- [ ] Dropdown changes → PATCH `/contacts/:id/sequence-step`
- [ ] Checkbox selection, Select All/Deselect All
- [ ] Row status pills (idle/generating/done/error/skipped)

**Verify:** Upload CSV → see contacts → change sequence step dropdown → reload → step persisted.

---

#### Unit 12 — Generation Pipeline UI
- [ ] Create `frontend/src/generator.js`
- [ ] UI: selected contacts + target sequence selector → "Run Generation" button
- [ ] Call `POST /api/projects/:projectId/generate` with contactIds + sequenceId
- [ ] Show progress: per-contact status updates (polling or SSE)
- [ ] Display results: success count, errors with messages

**Verify:** Select 3 contacts → run Sequence 1 → see progress → results saved.

---

#### Unit 13 — Generated Emails View
- [ ] Create `frontend/src/generated.js`
- [ ] Per-sequence tabs (Sequence 1, 2, 3...)
- [ ] Table: contact email, subject (copy), body (copy), status, timestamp, delete
- [ ] Filter by status
- [ ] Delete generated email → `DELETE /api/generated-emails/:id`

**Verify:** Run generation → view Generated tab → switch sequence tabs → copy subject/body → delete entry.

---

### Phase 3: Polish & Deploy (Units 14–16)

#### Unit 14 — Error Handling, Loading States, Validation
- [ ] Frontend: global error boundary, toast notifications
- [ ] Backend: consistent error responses, request validation
- [ ] Frontend: loading skeletons, disabled states during API calls
- [ ] Empty states for all views (no projects, no sequences, no contacts, no generated)
- [ ] Form validation (required fields, numeric ranges)

**Verify:** Trigger various errors → user-friendly messages; test empty states.

---

#### Unit 15 — Railway Deployment Config
- [ ] Create `frontend/Dockerfile` (multi-stage: build → nginx)
- [ ] Create `frontend/nginx.conf` (SPA fallback, proxy API calls)
- [ ] Update `railway.toml` with frontend service
- [ ] Configure Railway environment variables: `DATABASE_URL`, `GEMINI_API_KEY`, `FRONTEND_URL`, `VITE_API_URL`
- [ ] Test local Docker build for both services

**Verify:** `docker build` passes for both; Railway deployment succeeds.

---

#### Unit 16 — E2E Testing & Documentation
- [ ] Full flow test: create project → sequences → templates → import CSV → set steps → generate → view → copy
- [ ] Update `README.md` with setup, deployment, usage instructions
- [ ] Document API endpoints, data model, environment variables

**Verify:** Complete manual walkthrough on Railway; all features work end-to-end.

---

## Open Questions

- None currently. All product decisions resolved.

## Architecture Decisions

| Decision | Rationale |
|---|---|
| Single repo, separate frontend/backend folders | Simple monorepo; independent deploys via Railway services |
| Express + pg (not ORM) | Full SQL control, minimal dependencies, easy migrations |
| Client-side CSV parse (PapaParse) | Keeps large files off server; preview before import |
| Backend proxies Gemini | API key never exposed to browser; single auth point |
| Sequential generation | Avoids rate limits; simpler debugging; matches Phase 1 |
| Cascade delete on project | Clean data hygiene; no orphaned records |
| UUID primary keys | Distributed-friendly; no sequence conflicts |
| JSONB for csv_data | Flexible schema; stores all CSV columns without migrations |

## Session Notes

- **Frontend**: Vite + Vanilla JS + Tailwind (existing, enhanced)
- **Backend**: Express + pg (new)
- **Database**: PostgreSQL on Railway
- **AI**: Google Gemini (backend-proxied)
- **Auth**: None (single user)
- **Testing**: User tests on Railway after each unit; no automated test suite required

---

(End of file)