// backend/src/services/csvImport.js — CSV validation and bulk insert
import { query } from '../db.js';

export async function importContacts(projectId, headers, rows) {
  if (!headers.includes('email')) {
    throw new Error('CSV must contain an "email" column');
  }

  const emailIndex = headers.indexOf('email');
  const contacts = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const email = row[headers[emailIndex]];

    if (!email || !email.trim()) {
      throw new Error(`Row ${i + 1}: email is required`);
    }

    const csvData = {};
    for (let j = 0; j < headers.length; j++) {
      csvData[headers[j]] = row[headers[j]] ?? '';
    }

    contacts.push({
      project_id: projectId,
      csv_row_index: i,
      email: email.trim(),
      csv_data: csvData,
    });
  }

  // Bulk insert using a single query with multiple value sets
  if (contacts.length === 0) {
    return { imported: 0, contacts: [] };
  }

  const valuePlaceholders = contacts.map((_, i) => {
    const base = i * 4;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
  }).join(', ');

  const values = contacts.flatMap(c => [
    c.project_id,
    c.csv_row_index,
    c.email,
    JSON.stringify(c.csv_data),
  ]);

  const result = await query(
    `INSERT INTO contacts (project_id, csv_row_index, email, csv_data)
     VALUES ${valuePlaceholders}
     ON CONFLICT (project_id, csv_row_index) DO UPDATE SET
       email = EXCLUDED.email,
       csv_data = EXCLUDED.csv_data,
       current_sequence_step = 1
     RETURNING id, project_id, csv_row_index, email, current_sequence_step, csv_data, created_at`,
    values
  );

  return {
    imported: result.rows.length,
    contacts: result.rows.map(r => ({
      ...r,
      csv_data: typeof r.csv_data === 'string' ? JSON.parse(r.csv_data) : r.csv_data,
    })),
  };
}

export async function getContacts(projectId) {
  const result = await query(
    'SELECT id, project_id, csv_row_index, email, current_sequence_step, csv_data, created_at FROM contacts WHERE project_id = $1 ORDER BY csv_row_index',
    [projectId]
  );
  return result.rows.map(r => ({
    ...r,
    csv_data: typeof r.csv_data === 'string' ? JSON.parse(r.csv_data) : r.csv_data,
  }));
}

export async function updateContactSequenceStep(contactId, step) {
  if (step < 1) {
    throw new Error('Sequence step must be >= 1');
  }
  const result = await query(
    'UPDATE contacts SET current_sequence_step = $1 WHERE id = $2 RETURNING id, project_id, csv_row_index, email, current_sequence_step, csv_data, created_at',
    [step, contactId]
  );
  if (result.rows.length === 0) {
    return null;
  }
  const r = result.rows[0];
  return {
    ...r,
    csv_data: typeof r.csv_data === 'string' ? JSON.parse(r.csv_data) : r.csv_data,
  };
}