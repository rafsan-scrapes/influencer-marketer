-- backend/src/migrations/001_init.sql
-- Initial schema for Influencer Marketer

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