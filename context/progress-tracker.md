# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

**Phase 1.5: Authentication Backend** — Unit 9 (Auth Backend: Signup, Login, JWT, Password Hashing)

## Current Goal

Build authentication backend: bcrypt password hashing, JWT tokens, auth middleware, signup/login/me/logout endpoints.

## Completed

- Product scope, UI layout, template/condition model, placeholder system, and run output model finalised in `project-overview.md`.
- Workflow rules finalised in `ai-workflow-rules.md`.
- Architecture decisions, module boundaries, database schema, API contracts documented in `architecture.md`.
- **PostgreSQL → SQLite migration complete**: All backend files updated to use `better-sqlite3`, Node.js crypto (AES-256-GCM) for API key encryption, SQLite schema with UUIDs generated in-app.

## In Progress

### Phase 1: Backend Foundation (Units 1–8) — **COMPLETE**

#### Unit 1 — Express + SQLite Setup, Local Dev Config, Health Check
- [x] Create `backend/` folder with `package.json`
- [x] Install dependencies: `express`, `better-sqlite3`, `cors`, `dotenv`, `zod`, `bcrypt`, `jsonwebtoken`
- [x] Create `src/db.js` with better-sqlite3 connection and migration runner
- [x] Create `src/migrations/001_init.sql` with full SQLite schema (including users, user_settings)
- [x] Create `src/index.js` with Express app, CORS, JSON parser, error handler
- [x] Add health check endpoint `GET /health`
- [x] Add `npm run dev`, `npm run start`, `npm run migrate` scripts

**Verify:** `npm run dev` starts server on port 3000; `GET /health` returns `{ status: "ok" }`; `npm run migrate` creates tables in local SQLite.

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
- [x] Call Google Gemini REST API with user's API key from DB
- [x] Return `{ content: string }` or error

**Verify:** Set `GEMINI_API_KEY` in user settings → call endpoint with test prompt → returns generated text.

---

#### Unit 8 — Generation Pipeline API
- [x] Create `src/services/templateEngine.js` (mirrors frontend logic)
- [x] Create `src/routes/generation.js` with `POST /api/projects/:projectId/generate`
- [x] Sequential processing: evaluate conditions → substitute placeholders → call Gemini → save results
- [x] Handle skipped (empty subject+body), errors, AI failures

**Verify:** Create project → sequences → templates → contacts → call generate endpoint → results saved to generated_emails.

---

### Phase 1.5: Authentication Backend (Units 9–11)

#### Unit 9 — Auth Backend: Signup, Login, JWT, Password Hashing
- [ ] Create `src/services/auth.js` with bcrypt password hashing, JWT sign/verify, API key encryption
- [ ] Create `src/middleware/auth.js` — JWT verification, attaches `req.user`
- [ ] Create `src/routes/auth.js` with:
  - `POST /auth/signup` — email, password → creates user, returns JWT in httpOnly cookie
  - `POST /auth/login` — email, password → returns JWT in httpOnly cookie
  - `GET /auth/me` — returns current user + settings (requires auth)
  - `POST /auth/logout` — clears cookie
- [ ] Add `pgcrypto` extension for encryption or app-level AES-256
- [ ] Update `src/index.js` to mount auth routes and apply auth middleware to protected routes

**Verify:** Signup → login → GET /auth/me returns user → logout → cookie cleared.

---

#### Unit 10 — User Settings API (Gemini API Key, Defaults)
- [ ] Create `src/routes/settings.js` with:
  - `GET /api/settings` — returns masked API key, default model, temperature
  - `PATCH /api/settings` — update API key (encrypted), model, temperature
- [ ] API key stored encrypted in `user_settings.gemini_api_key_encrypted`
- [ ] GET returns masked key (e.g., `sk-****1234`) for display

**Verify:** Login → PATCH /api/settings with API key → GET returns masked key → generation uses user's key.

---

#### Unit 11 — Migration Update & Protected Routes
- [ ] Update `src/migrations/001_init.sql` with users, user_settings tables and triggers
- [ ] Run migration on local DB
- [ ] Verify all existing routes (projects, sequences, templates, contacts, generation) are protected by auth middleware
- [ ] Verify user-scoping: users only see their own projects/data

**Verify:** Create 2 users → each sees only their projects → generation uses correct API key per user.

---

### Phase 2: Frontend Integration (Units 12–19)

#### Unit 12 — Auth Frontend: Login, Signup, Session, Protected Routes
- [ ] Create `frontend/src/auth.js` — auth state, login/logout/signup, token in httpOnly cookie, auto-refresh
- [ ] Create `frontend/src/api.js` with fetch wrappers for all endpoints; attaches credentials
- [ ] Create `frontend/src/store.js` (UI prefs only: theme, lastProjectId)
- [ ] Update `frontend/src/main.js` — auth initialization, protected route guards, redirect to login if unauthenticated
- [ ] Login/Signup pages (simple forms, error handling)
- [ ] Persist last selected project in localStorage

**Verify:** Signup → login → reload → auto-logged in → logout → redirect to login.

---

#### Unit 13 — Project Switcher UI
- [ ] Create `frontend/src/projects.js` with project list, create, switch, delete UI
- [ ] Project selector in header/sidebar
- [ ] Call project API endpoints

**Verify:** Create 2 projects → switch between them → reload → last project restored.

---

#### Unit 14 — Sequence Manager UI
- [ ] Create `frontend/src/sequences.js` with sequence list per project
- [ ] Add sequence: name input, add button
- [ ] Reorder: drag-and-drop or up/down buttons
- [ ] Delete sequence with confirmation
- [ ] Call sequence API endpoints

**Verify:** In project → add 3 sequences → reorder → delete middle → verify order.

---

#### Unit 15 — Template Editor per Sequence
- [ ] Adapt `frontend/src/templateEditor.js` for per-sequence context
- [ ] Sequence selector (tabs or dropdown) to switch template editor context
- [ ] Default block: Subject, Body, Prompt, AI toggle, model select, temperature, first-line-split
- [ ] Condition blocks: add/delete/reorder, AND-joined condition rows
- [ ] AI config per block (use_ai, model, temperature) — defaults from user settings
- [ ] Column chips from loaded CSV headers
- [ ] Persist templates via API (not localStorage)

**Verify:** Select sequence → add default template → add condition block → add conditions → switch sequence → templates isolated.

---

#### Unit 16 — Contacts Table with Sequence Step Dropdown
- [ ] Create `frontend/src/contacts.js` (replaces `brands.js`)
- [ ] CSV upload with PapaParse (client-side preview)
- [ ] Send to backend `/contacts/import` on confirm
- [ ] Contacts table: all CSV columns + **Current Sequence Step dropdown** per row
- [ ] Dropdown changes → PATCH `/contacts/:id/sequence-step`
- [ ] Checkbox selection, Select All/Deselect All
- [ ] Row status pills (idle/generating/done/error/skipped)

**Verify:** Upload CSV → see contacts → change sequence step dropdown → reload → step persisted.

---

#### Unit 17 — Generation Pipeline UI
- [ ] Create `frontend/src/generator.js`
- [ ] UI: selected contacts + target sequence selector → "Run Generation" button
- [ ] Call `POST /api/projects/:projectId/generate` with contactIds + sequenceId
- [ ] Show progress: per-contact status updates (polling or SSE)
- [ ] Display results: success count, errors with messages

**Verify:** Select 3 contacts → run Sequence 1 → see progress → results saved.

---

#### Unit 18 — Generated Emails View
- [ ] Create `frontend/src/generated.js`
- [ ] Per-sequence tabs (Sequence 1, 2, 3...)
- [ ] Table: contact email, subject (copy), body (copy), status, timestamp, delete
- [ ] Filter by status
- [ ] Delete generated email → `DELETE /api/generated-emails/:id`

**Verify:** Run generation → view Generated tab → switch sequence tabs → copy subject/body → delete entry.

---

#### Unit 19 — User Settings UI
- [ ] Create `frontend/src/settings.js`
- [ ] Settings page: Gemini API key (password input), default model, default temperature
- [ ] Save → PATCH /api/settings
- [ ] Mask API key in display

**Verify:** Enter API key → save → reload → key masked → generation works.

---

### Phase 3: Polish & Local Production Build (Units 20–22)

#### Unit 20 — Error Handling, Loading States, Validation
- [ ] Frontend: global error boundary, toast notifications
- [ ] Backend: consistent error responses, request validation
- [ ] Frontend: loading skeletons, disabled states during API calls
- [ ] Empty states for all views (no projects, no sequences, no contacts, no generated)
- [ ] Form validation (required fields, numeric ranges)

**Verify:** Trigger various errors → user-friendly messages; test empty states.

---

#### Unit 21 — Local Production Build Config
- [ ] Create `frontend/Dockerfile` (multi-stage: build → nginx) for optional containerized local run
- [ ] Create `frontend/nginx.conf` (SPA fallback, proxy API calls)
- [ ] Create `backend/Dockerfile` for optional containerized local run
- [ ] Configure local environment variables: `JWT_SECRET`, `ENCRYPTION_KEY`, `FRONTEND_URL`, `PORT`, `DB_PATH`, `VITE_API_URL`
- [ ] Test local Docker build for both services (optional)

**Verify:** `docker build` passes for both; `docker compose up` runs full stack locally (optional).

---

#### Unit 22 — E2E Testing & Documentation
- [ ] Full flow test: signup → login → settings (API key) → create project → sequences → templates → import CSV → set steps → generate → view → copy
- [ ] Update `README.md` with setup, local run instructions, usage guide
- [ ] Document API endpoints, data model, environment variables

**Verify:** Complete manual walkthrough locally; all features work end-to-end.

---

## Open Questions

- None currently. All product decisions resolved.

## Architecture Decisions

| Decision | Rationale |
|---|---|
| Single repo, separate frontend/backend folders | Simple monorepo; can run independently or together locally |
| Express + better-sqlite3 (not ORM) | Full SQL control, minimal dependencies, easy migrations, zero-config local dev |
| Client-side CSV parse (PapaParse) | Keeps large files off server; preview before import |
| Backend proxies Gemini | API key never exposed to browser; single auth point |
| Sequential generation | Avoids rate limits; simpler debugging; matches Phase 1 |
| Cascade delete on project | Clean data hygiene; no orphaned records |
| UUID primary keys (app-generated) | Distributed-friendly; no sequence conflicts |
| JSON TEXT for csv_data | Flexible schema; stores all CSV columns without migrations |
| JWT in httpOnly cookies | Secure, CSRF-resistant, automatic with credentials |
| Per-user encrypted API keys (AES-256-GCM) | Multi-user support, no .env secrets needed |

## Session Notes

- **Frontend**: Vite + Vanilla JS + Tailwind (existing, enhanced)
- **Backend**: Express + better-sqlite3 (new)
- **Database**: SQLite (local file `./data/influencer_marketer.sqlite`)
- **AI**: Google Gemini (backend-proxied, per-user API key)
- **Auth**: Email/password, JWT in httpOnly cookies
- **Testing**: User tests locally after each unit; no automated test suite required

---

(End of file)