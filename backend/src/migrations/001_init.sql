-- backend/src/migrations/001_init.sql
-- Initial SQLite schema for Influencer Marketer
-- UUIDs generated in application (crypto.randomUUID())
-- Timestamps stored as ISO8601 TEXT (e.g., 2026-10-20T12:34:56.789Z)
-- JSON stored as TEXT (JSON.stringify/parse)
-- Booleans stored as INTEGER (0/1)

-- Users
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User Settings (Gemini API key, defaults)
CREATE TABLE user_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    gemini_api_key_encrypted TEXT, -- encrypted with AES-256-GCM (app-level)
    default_ai_model TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
    default_ai_temperature REAL NOT NULL DEFAULT 0.30,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Projects (user-scoped)
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sequences (steps within a project)
CREATE TABLE sequences (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Sequence',
    step_order INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (project_id, step_order)
);

-- Templates (default + condition blocks per sequence)
CREATE TABLE templates (
    id TEXT PRIMARY KEY,
    sequence_id TEXT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    is_default INTEGER NOT NULL DEFAULT 0,
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    prompt TEXT NOT NULL DEFAULT '',
    use_ai INTEGER NOT NULL DEFAULT 1,
    ai_model TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
    ai_temperature REAL NOT NULL DEFAULT 0.30,
    subject_from_first_line INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Allow at most one default template per sequence
CREATE UNIQUE INDEX idx_templates_one_default_per_sequence
    ON templates (sequence_id)
    WHERE is_default = 1;

-- Conditions (AND-joined per template)
CREATE TABLE conditions (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    column_name TEXT NOT NULL,
    operator TEXT NOT NULL CHECK (operator IN ('equals', 'contains', 'is_empty')),
    value TEXT NOT NULL DEFAULT '',
    condition_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Contacts (from CSV import)
CREATE TABLE contacts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    csv_row_index INTEGER NOT NULL,
    email TEXT NOT NULL,
    current_sequence_step INTEGER NOT NULL DEFAULT 1,
    csv_data TEXT NOT NULL DEFAULT '{}', -- JSON string
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (project_id, csv_row_index)
);

-- Generated Emails (per contact per sequence)
CREATE TABLE generated_emails (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    sequence_id TEXT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'skipped', 'error')),
    ai_used INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_sequences_project ON sequences(project_id);
CREATE INDEX idx_templates_sequence ON templates(sequence_id);
CREATE INDEX idx_conditions_template ON conditions(template_id);
CREATE INDEX idx_contacts_project ON contacts(project_id);
CREATE INDEX idx_generated_contact ON generated_emails(contact_id);
CREATE INDEX idx_generated_sequence ON generated_emails(sequence_id);
CREATE INDEX idx_generated_status ON generated_emails(status);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_users_updated_at
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER update_user_settings_updated_at
    AFTER UPDATE ON user_settings
    BEGIN
        UPDATE user_settings SET updated_at = datetime('now') WHERE user_id = NEW.user_id;
    END;

CREATE TRIGGER update_projects_updated_at
    AFTER UPDATE ON projects
    BEGIN
        UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER update_templates_updated_at
    AFTER UPDATE ON templates
    BEGIN
        UPDATE templates SET updated_at = datetime('now') WHERE id = NEW.id;
    END;
