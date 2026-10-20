# Influencer Marketer

## Overview

Influencer Marketer is a **multi-project email campaign tool** for running personalised multi-step email sequences to influencers/creators. The user creates projects, each with its own CSV of contacts, configurable email sequences (steps), and templates with conditional logic. An AI model (Google Gemini via backend proxy) fills templates using each row's values. The output — generated Subject and Body per contact per sequence step — is saved to a PostgreSQL database. The app does not send emails; it generates copy-pasteable content for manual outreach.

## Goals

1. **Multi-project workspace**: Create, switch, and manage multiple independent projects
2. **Multi-step email sequences**: Each project defines N sequences (steps); contacts advance manually through steps via a dropdown
3. **Per-sequence templates with conditions**: Each sequence has a default template + any number of if-condition override blocks (extends Phase 1 logic)
4. **CSV-driven personalization**: Upload CSV per project; columns become placeholders `[Column Name]` for templates and condition evaluation
5. **AI-powered generation**: Google Gemini API (backend-proxied) fills templates per contact per sequence step; each template controls AI usage, model, and prompt
6. **Persistent generation history**: All generated emails (subject/body) stored in PostgreSQL per contact per sequence; viewable, copyable, deletable
7. **Railway-ready deployment**: Static frontend + Express backend + PostgreSQL on Railway

## Core User Flow

1. **Create Project** → Enter project name → lands on Project Dashboard
2. **Configure Sequences** → Add/reorder sequence steps (Sequence 1, Sequence 2, Sequence 3...)
3. **Configure Templates per Sequence** → For each sequence: default Subject/Body/Prompt + condition blocks with overrides
4. **Import CSV** → Upload contacts CSV on Brands/Contacts tab → columns become placeholder chips
5. **Set Contact Sequence Step** → Per contact dropdown shows current step (1, 2, 3...); user can manually override
6. **Run Generation** → Select contacts → Choose sequence step to run → backend calls Gemini → saves generated emails to DB
7. **Review & Copy** → Generated emails tab shows Subject/Body per contact per sequence with copy buttons

## Features

### Project Management
- **Project List**: Sidebar or top bar showing all projects; create new, switch, delete
- **Project Dashboard**: Overview of sequences, contact count, generation stats

### Sequence Management (per project)
- **Sequence List**: Ordered steps (Sequence 1, Sequence 2, ...); drag to reorder; add/remove
- **Sequence Settings**: Name, description per step

### Template Editor (per sequence)
- **Column Chips**: Clickable `[Column Name]` chips from loaded CSV headers
- **Default Block**: Subject input, Body textarea, Prompt textarea, AI toggle + model config, first-line-split checkbox
- **Condition Blocks**: Add multiple blocks; each has AND-joined condition rows (column, operator, value) + own Subject/Body/Prompt/AI config
- **Evaluation Logic**: Same as Phase 1 — first matching condition block wins, else default; empty subject+body = skip

### CSV Import & Contacts Table
- **Client-side Parse**: PapaParse in browser; preview before sending to backend
- **Contacts Table**: All CSV columns visible; checkbox selection; **Current Sequence Step dropdown per row** (manual override, persists to DB)
- **Row Status**: Idle / Generating / Done / Error / Skipped per sequence run

### AI Configuration (per template block)
- **Use AI Toggle**: On/off per template (default + each condition block)
- **Model Selection**: Gemini model (e.g., `gemini-1.5-flash`, `gemini-1.5-pro`)
- **Temperature**: Creativity control (0.0–1.0)
- **Prompt**: Instruction for AI; can reference `[Subject]` and `[Body]` (reserved tokens)

### Generation Pipeline (Run)
1. User selects contacts + target sequence step
2. Backend evaluates conditions per contact → picks template block
3. Substitutes `[Column Name]` placeholders from contact's CSV data
4. If AI enabled: sends substituted Subject/Body/Prompt to Gemini via backend proxy
5. Saves result (subject, body, status) to `generated_emails` table
6. Updates contact's `current_sequence_step` if desired (optional auto-advance)

### Generated Emails View
- **Per-sequence tabs**: View all generated emails for Sequence 1, 2, 3...
- **Table**: Contact name/email, Subject (copy), Body (copy), Status, Timestamp, Delete button
- **Filter**: By status, by contact

### AI Provider: Google Gemini
- **Backend Proxy**: Frontend never sees API key; backend calls `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **API Key**: Stored in Railway environment variable `GEMINI_API_KEY`
- **Streaming**: Optional; start with non-streaming for simplicity

## Placeholder System

- Syntax: `[Column Name]` — exact CSV header name, case-insensitive
- Source: CSV row values only (stored in `contacts.csv_data` JSONB)
- **Reserved tokens in Prompt**: `[Subject]` and `[Body]` expand to the selected block's already-filled Subject and Body
- `[email_sequence]` is a regular CSV column (user-filled before upload)
- **Validation**: If any placeholder resolves to empty string → error `"[Column Name] is empty in CSV for this row"`
- **First-line subject split** (per-block opt-in): AI returns final subject on first non-empty line; app splits into Subject + Body

## Scope

### In Scope
- Multi-project CRUD (single user, no auth)
- Sequence step management (add/reorder/delete)
- Template editor per sequence (default + condition blocks)
- CSV import → contacts table with sequence step dropdown
- Sequential generation per sequence step (backend orchestrated)
- Gemini AI integration via backend proxy
- PostgreSQL persistence (projects, sequences, templates, conditions, contacts, generated_emails)
- Railway deployment (frontend static + backend service + PostgreSQL)
- Vite + vanilla JS + Tailwind frontend; Express + pg backend

### Out of Scope
- Sending emails (SMTP, Gmail API, any mailbox integration)
- User authentication / multi-tenancy
- Reply detection, tracking, open rates
- Automatic sequence advancement (scheduling, triggers)
- CSV export of results (Phase 2)
- A/B testing, analytics dashboard
- Team collaboration, sharing

## Success Criteria

1. Create project → add 3 sequences → configure templates per sequence → import CSV → see contacts table
2. Set contact sequence step via dropdown → persists to DB → survives reload
3. Run Sequence 1 for selected contacts → Gemini generates emails → saved to DB → visible in Generated tab
4. Run Sequence 2 for same contacts → new emails generated → separate tab/view
5. Condition blocks work per sequence (first match wins, fallback to default)
6. Empty placeholder cells block generation with specific error message
7. AI toggle per template works (on = Gemini call, off = pure substitution)
8. All data survives browser reload and server restart (PostgreSQL)
9. `npm run build` passes for frontend; `npm run start` works for backend
10. Deployed to Railway: frontend accessible, backend API responds, DB connected

## Data Shapes (API Contracts)

### Project
```ts
{ id: string, name: string, created_at: string, updated_at: string }
```

### Sequence
```ts
{ id: string, project_id: string, name: string, step_order: number, created_at: string }
```

### Template Block (default or condition)
```ts
{
  id: string,
  sequence_id: string,
  is_default: boolean,
  subject: string,
  body: string,
  prompt: string,
  use_ai: boolean,
  ai_model: string,
  ai_temperature: number,
  subject_from_first_line: boolean,
  conditions: Condition[] // empty for default block
}
```

### Condition
```ts
{ id: string, template_id: string, column_name: string, operator: 'equals'|'contains'|'is_empty', value: string, condition_order: number }
```

### Contact
```ts
{
  id: string,
  project_id: string,
  csv_row_index: number,
  email: string,
  current_sequence_step: number, // 1-based
  csv_data: Record<string, string>, // all columns as JSONB
  created_at: string
}
```

### Generated Email
```ts
{
  id: string,
  contact_id: string,
  sequence_id: string,
  subject: string,
  body: string,
  status: 'pending'|'generated'|'skipped'|'error',
  ai_used: boolean,
  error_message: string | null,
  generated_at: string
}
```

---

(End of file)