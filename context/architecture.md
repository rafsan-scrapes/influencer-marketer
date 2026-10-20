# Architecture

## Repository Structure

```
influencer-marketer/
├── frontend/                 # Vite + Vanilla JS + Tailwind
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── main.js           # Entry point, tab routing, project context
│   │   ├── style.css
│   │   ├── api.js            # API client (fetch wrappers)
│   │   ├── store.js          # UI preferences only (theme, lastProjectId)
│   │   ├── projects.js       # Project list, create, switch, delete UI
│   │   ├── sequences.js      # Sequence manager per project
│   │   ├── templateEditor.js # Template editor per sequence (AI config per block)
│   │   ├── contacts.js       # CSV import, contacts table, sequence step dropdown
│   │   ├── generator.js      # Run pipeline UI (sequence selection, progress)
│   │   ├── generated.js      # Generated emails view per sequence
│   │   ├── templates.js      # Shared: placeholder logic (extract, substitute, evaluate)
│   │   └── utils.js          # Shared utilities (escapeHtml, date formatting)
│   └── public/
├── backend/                  # Express + pg
│   ├── package.json
│   ├── src/
│   │   ├── index.js          # Express app setup, middleware, routes
│   │   ├── db.js             # pg pool, migrations runner
│   │   ├── migrations/       # SQL migration files (001_init.sql, etc.)
│   │   ├── routes/
│   │   │   ├── projects.js
│   │   │   ├── sequences.js
│   │   │   ├── templates.js
│   │   │   ├── contacts.js
│   │   │   ├── generation.js
│   │   │   ├── generated.js
│   │   │   └── ai.js
│   │   ├── services/
│   │   │   ├── templateEngine.js  # Condition evaluation, placeholder substitution
│   │   │   ├── gemini.js          # Gemini API client
│   │   │   └── csvImport.js       # CSV validation, bulk insert
│   │   └── utils/
│   │       ├── errors.js
│   │       └── validation.js
│   └── Dockerfile
├── railway.toml              # Railway service definitions
├── package.json              # Root workspace (optional)
└── README.md
```

## Module Boundaries

### Frontend Modules

| Module | Responsibility | Imports |
|---|---|---|
| `main.js` | App bootstrap, tab routing, global project context | all UI modules |
| `api.js` | **Only** module calling `fetch` to backend | — |
| `store.js` | UI preferences (theme, lastProjectId) in localStorage | — |
| `projects.js` | Project CRUD UI, project switcher | `api.js`, `store.js` |
| `sequences.js` | Sequence list, add/reorder/delete per project | `api.js` |
| `templateEditor.js` | Template editor per sequence (default + conditions + AI config) | `api.js`, `templates.js` |
| `contacts.js` | CSV import (PapaParse), contacts table, sequence step dropdown | `api.js`, `templates.js` |
| `generator.js` | Run UI: select contacts → pick sequence → start generation → progress | `api.js` |
| `generated.js` | Generated emails view per sequence (tabs, copy, delete) | `api.js` |
| `templates.js` | **Pure logic**: `extractPlaceholders`, `substitutePlaceholders`, `evaluateConditions`, `buildPromptPayload` | — |
| `utils.js` | `escapeHtml`, `formatDate`, `debounce`, etc. | — |

### Backend Modules

| Module | Responsibility |
|---|---|
| `index.js` | Express setup, CORS, JSON body parser, route mounting, error handler |
| `db.js` | pg Pool, `query()` helper, migration runner (`npm run migrate`) |
| `routes/projects.js` | `GET/POST/PATCH/DELETE /api/projects` |
| `routes/sequences.js` | `GET/POST/PATCH/DELETE /api/projects/:projectId/sequences`, reorder |
| `routes/templates.js` | `GET/POST/PATCH/DELETE /api/sequences/:sequenceId/templates`, conditions |
| `routes/contacts.js` | `POST /api/projects/:projectId/contacts/import`, `GET /api/projects/:projectId/contacts`, `PATCH /api/contacts/:id/sequence-step` |
| `routes/generation.js` | `POST /api/projects/:projectId/generate` (sequential per contact) |
| `routes/generated.js` | `GET /api/projects/:projectId/generated-emails`, `DELETE /api/generated-emails/:id` |
| `routes/ai.js` | `POST /api/ai/generate` (Gemini proxy) |
| `services/templateEngine.js` | Condition evaluation, placeholder substitution (mirrors frontend `templates.js`) |
| `services/gemini.js` | `generateContent({ model, temperature, systemPrompt, userPrompt })` |
| `services/csvImport.js` | Validate CSV headers, bulk insert contacts with `csv_data` JSONB |
| `utils/errors.js` | Custom error classes (NotFound, ValidationError, etc.) |
| `utils/validation.js` | Zod schemas for request bodies |

## Database Schema (PostgreSQL)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sequences (steps within a project)
CREATE TABLE sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Sequence',
    step_order INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, step_order)
);

-- Templates (default + condition blocks per sequence)
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    prompt TEXT NOT NULL DEFAULT '',
    use_ai BOOLEAN NOT NULL DEFAULT TRUE,
    ai_model VARCHAR(100) NOT NULL DEFAULT 'gemini-1.5-flash',
    ai_temperature NUMERIC(3,2) NOT NULL DEFAULT 0.30,
    subject_from_first_line BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sequence_id, is_default) WHERE is_default = TRUE
);

-- Conditions (AND-joined per template)
CREATE TABLE conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    column_name VARCHAR(255) NOT NULL,
    operator VARCHAR(20) NOT NULL CHECK (operator IN ('equals', 'contains', 'is_empty')),
    value TEXT NOT NULL DEFAULT '',
    condition_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contacts (from CSV import)
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    csv_row_index INT NOT NULL,
    email VARCHAR(320) NOT NULL,
    current_sequence_step INT NOT NULL DEFAULT 1,
    csv_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, csv_row_index)
);

-- Generated Emails (per contact per sequence)
CREATE TABLE generated_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'skipped', 'error')),
    ai_used BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_sequences_project ON sequences(project_id);
CREATE INDEX idx_templates_sequence ON templates(sequence_id);
CREATE INDEX idx_conditions_template ON conditions(template_id);
CREATE INDEX idx_contacts_project ON contacts(project_id);
CREATE INDEX idx_generated_contact ON generated_emails(contact_id);
CREATE INDEX idx_generated_sequence ON generated_emails(sequence_id);
CREATE INDEX idx_generated_status ON generated_emails(status);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## API Contracts

### Projects
```
GET    /api/projects                    → Project[]
POST   /api/projects     { name }       → Project
PATCH  /api/projects/:id { name }       → Project
DELETE /api/projects/:id                → { success: true }
```

### Sequences
```
GET    /api/projects/:projectId/sequences                    → Sequence[]
POST   /api/projects/:projectId/sequences  { name }          → Sequence
PATCH  /api/projects/:projectId/sequences/:id { name }       → Sequence
DELETE /api/projects/:projectId/sequences/:id                → { success: true }
POST   /api/projects/:projectId/sequences/reorder  { ids: string[] } → { success: true }
```

### Templates
```
GET    /api/sequences/:sequenceId/templates                          → Template[]
POST   /api/sequences/:sequenceId/templates  { is_default?, subject, body, prompt, use_ai, ai_model, ai_temperature, subject_from_first_line } → Template
PATCH  /api/templates/:id { subject, body, prompt, use_ai, ai_model, ai_temperature, subject_from_first_line } → Template
DELETE /api/templates/:id                                            → { success: true }

POST   /api/templates/:templateId/conditions  { column_name, operator, value } → Condition
PATCH  /api/conditions/:id { column_name, operator, value } → Condition
DELETE /api/conditions/:id                                           → { success: true }
```

### Contacts
```
POST   /api/projects/:projectId/contacts/import
  Body: { headers: string[], rows: Record<string,string>[] }
  → { imported: number, contacts: Contact[] }

GET    /api/projects/:projectId/contacts                    → Contact[]
PATCH  /api/contacts/:id/sequence-step  { step: number }   → Contact
```

### Generation
```
POST   /api/projects/:projectId/generate
  Body: { contactIds: string[], sequenceId: string }
  → { results: { contactId, status, subject, body, error }[] }
```
- Processes contacts **sequentially** (one at a time)
- For each contact: evaluates conditions → substitutes placeholders → calls Gemini (if `use_ai`) → saves to `generated_emails`

### Generated Emails
```
GET    /api/projects/:projectId/generated-emails?sequenceId=:seqId → GeneratedEmail[]
DELETE /api/generated-emails/:id                                   → { success: true }
```

### AI Proxy
```
POST   /api/ai/generate
  Body: { model, temperature, systemPrompt, userPrompt }
  → { content: string }
```
- Calls `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=${GEMINI_API_KEY}`
- Returns `candidates[0].content.parts[0].text`

## Shared Logic: Template Engine

Both frontend (`src/templates.js`) and backend (`services/templateEngine.js`) implement identical logic:

```js
// Placeholder extraction
extractPlaceholders(text) → string[]

// Placeholder substitution (throws on empty cell)
substitutePlaceholders(text, row, extras) → string

// Condition evaluation (first match wins, else default)
evaluateConditions(conditionBlocks, row, defaultBlock) → block

// Prompt payload for AI
buildPromptPayload(block, row) → { system, userContent, subject, body }
```

**Critical invariant**: Frontend and backend must produce identical results for the same inputs. Any change to `templates.js` must be mirrored in `templateEngine.js`.

## Environment Variables

### Backend (Railway)
```
DATABASE_URL=postgresql://...          # Provided by Railway PostgreSQL
GEMINI_API_KEY=your-gemini-key         # From Google AI Studio
PORT=3000                              # Provided by Railway
NODE_ENV=production
FRONTEND_URL=https://your-app.railway.app  # For CORS
```

### Frontend (Vite)
```
VITE_API_URL=https://your-api.railway.app  # Backend URL
```

## Deployment (Railway)

### `railway.toml`
```toml
[build]
builder = "docker"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "on-failure"

[[services]]
name = "backend"
dockerfilePath = "backend/Dockerfile"

[[services]]
name = "frontend"
dockerfilePath = "frontend/Dockerfile"
```

### Backend Dockerfile
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --production
COPY backend/src ./src
COPY backend/migrations ./migrations
EXPOSE 3000
CMD ["node", "src/index.js"]
```

### Frontend Dockerfile
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Frontend-Backend Communication

- Frontend calls backend via `VITE_API_URL` (e.g., `https://api.railway.app`)
- All API calls go through `src/api.js` (centralized fetch wrapper)
- Backend serves API only; frontend served separately (or via nginx in same container)
- CORS configured on backend for `FRONTEND_URL`

## Error Handling

- Backend returns consistent error format:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {} } }
  ```
- Frontend `api.js` throws typed errors; UI modules catch and display user-friendly messages
- Generation errors per-contact saved to `generated_emails.error_message`

## Security

- No authentication (single user)
- Gemini API key only on backend (env var)
- SQL injection prevented via parameterized queries (pg)
- Input validation via Zod on all POST/PATCH bodies
- CORS restricted to `FRONTEND_URL`

## Testing Strategy

- **Backend**: Unit tests for `templateEngine.js`, `gemini.js`, route handlers (Vitest + Supertest)
- **Frontend**: Unit tests for `templates.js` (shared logic), integration tests for UI modules (jsdom)
- **E2E**: Manual verification per unit (user will test on Railway)

## Migration Strategy

- Fresh start (no data migration from localStorage)
- Migrations in `backend/src/migrations/` run on startup via `db.js`
- `npm run migrate` command for manual execution