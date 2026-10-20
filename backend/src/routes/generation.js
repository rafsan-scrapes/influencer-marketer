// backend/src/routes/generation.js — Generation Pipeline API
import express from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { evaluateConditions, substitutePlaceholders, buildPromptPayload, splitFirstLine } from '../services/templateEngine.js';
import { generateContent } from '../services/gemini.js';
import { getUserDecryptedApiKey } from '../services/auth.js';

const router = express.Router();

const generateSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1),
  sequenceId: z.string().uuid(),
});

// POST /api/projects/:projectId/generate - Run generation for selected contacts and sequence
router.post('/projects/:projectId/generate', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const data = generateSchema.parse(req.body);
    const userId = req.user.id;

    // Fetch user's Gemini API key
    const apiKey = await getUserDecryptedApiKey(userId);
    if (!apiKey) {
      return res.status(400).json({ error: { code: 'MISSING_API_KEY', message: 'Gemini API key not configured. Add it in Settings.' } });
    }

    // Fetch contacts
    const placeholders = data.contactIds.map((_, i) => `$${i + 1}`).join(',');
    const contactsResult = await query(
      `SELECT id, project_id, csv_row_index, email, current_sequence_step, csv_data
       FROM contacts WHERE id IN (${placeholders}) AND project_id = $${data.contactIds.length + 1}`,
      [...data.contactIds, projectId]
    );

    if (contactsResult.rows.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No valid contacts found' } });
    }

    const contacts = contactsResult.rows.map(r => ({
      ...r,
      csv_data: typeof r.csv_data === 'string' ? JSON.parse(r.csv_data) : r.csv_data,
    }));

    // Fetch sequence
    const sequenceResult = await query(
      'SELECT id, project_id, name, step_order FROM sequences WHERE id = $1 AND project_id = $2',
      [data.sequenceId, projectId]
    );

    if (sequenceResult.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Sequence not found' } });
    }

    const sequence = sequenceResult.rows[0];

    // Fetch templates for this sequence
    const templatesResult = await query(
      `SELECT id, sequence_id, is_default, subject, body, prompt, use_ai, ai_model, ai_temperature, subject_from_first_line
       FROM templates WHERE sequence_id = $1 ORDER BY is_default DESC, created_at`,
      [sequence.id]
    );

    if (templatesResult.rows.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No templates configured for this sequence' } });
    }

    // Fetch conditions for each template
    const templates = [];
    for (const t of templatesResult.rows) {
      const conditionsResult = await query(
        'SELECT id, template_id, column_name, operator, value, condition_order FROM conditions WHERE template_id = $1 ORDER BY condition_order',
        [t.id]
      );
      templates.push({
        ...t,
        conditions: conditionsResult.rows.map(c => ({
          ...c,
          operator: c.operator, // already 'equals'|'contains'|'is_empty'
        })),
      });
    }

    // Separate default and condition blocks
    const defaultBlock = templates.find(t => t.is_default);
    const conditionBlocks = templates.filter(t => !t.is_default);

    if (!defaultBlock) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No default template found for this sequence' } });
    }

    const results = [];

    // Process each contact sequentially
    for (const contact of contacts) {
      try {
        // Evaluate conditions to pick template block
        const row = contact.csv_data;
        const block = evaluateConditions(conditionBlocks, row, defaultBlock);

        // Substitute placeholders in subject and body
        const subject = substitutePlaceholders(block.subject || '', row);
        const body = substitutePlaceholders(block.body || '', row);

        // Check if both empty (skip)
        if (subject.trim() === '' && body.trim() === '') {
          // Save as skipped
          await query(
            `INSERT INTO generated_emails (contact_id, sequence_id, subject, body, status, ai_used, error_message)
             VALUES ($1, $2, $3, $4, 'skipped', FALSE, $5)
             ON CONFLICT DO NOTHING
             RETURNING id`,
            [contact.id, sequence.id, subject, body, 'Subject and Body are both empty']
          );

          results.push({
            contactId: contact.id,
            status: 'skipped',
            subject,
            body,
            error: 'Subject and Body are both empty',
          });
          continue;
        }

        let finalSubject = subject;
        let finalBody = body;
        let aiUsed = false;
        let errorMessage = null;

        if (block.use_ai) {
          // Build prompt payload
          const { system, userContent } = buildPromptPayload(block, row);

          // Call Gemini with user's API key
          try {
            const content = await generateContent({
              model: block.ai_model || 'gemini-1.5-flash',
              temperature: block.ai_temperature ?? 0.3,
              systemPrompt: system,
              userPrompt: userContent,
              apiKey,
            });

            aiUsed = true;

            // Handle first-line subject split
            if (block.subject_from_first_line && content && content.trim() !== '') {
              const split = splitFirstLine(content);
              if (split.subject !== '') finalSubject = split.subject;
              finalBody = split.body !== '' ? split.body : body;
            } else {
              finalBody = content && content.trim() !== '' ? content : body;
            }
          } catch (aiErr) {
            errorMessage = aiErr.message;
            finalBody = body; // fallback to template body
          }
        }

        // Save generated email
        const status = errorMessage ? 'error' : 'generated';
        await query(
          `INSERT INTO generated_emails (contact_id, sequence_id, subject, body, status, ai_used, error_message)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [contact.id, sequence.id, finalSubject, finalBody, status, aiUsed, errorMessage]
        );

        results.push({
          contactId: contact.id,
          status,
          subject: finalSubject,
          body: finalBody,
          error: errorMessage,
        });
      } catch (err) {
        // Handle placeholder substitution errors or other errors
        const errorMessage = err.message;
        await query(
          `INSERT INTO generated_emails (contact_id, sequence_id, subject, body, status, ai_used, error_message)
           VALUES ($1, $2, $3, $4, 'error', FALSE, $5)
           RETURNING id`,
          [contact.id, sequence.id, '', '', errorMessage]
        );

        results.push({
          contactId: contact.id,
          status: 'error',
          subject: '',
          body: '',
          error: errorMessage,
        });
      }
    }

    res.json({ results });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
    }
    next(err);
  }
});

export default router;