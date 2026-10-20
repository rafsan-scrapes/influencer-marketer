// backend/src/routes/templates.js — Template & Condition CRUD API
import express from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { query } from '../db.js';

const router = express.Router();

const createTemplateSchema = z.object({
  is_default: z.boolean().default(false),
  subject: z.string().default(''),
  body: z.string().default(''),
  prompt: z.string().default(''),
  use_ai: z.boolean().default(true),
  ai_model: z.string().default('gemini-1.5-flash'),
  ai_temperature: z.number().min(0).max(1).default(0.3),
  subject_from_first_line: z.boolean().default(false),
});

const updateTemplateSchema = z.object({
  subject: z.string().optional(),
  body: z.string().optional(),
  prompt: z.string().optional(),
  use_ai: z.boolean().optional(),
  ai_model: z.string().optional(),
  ai_temperature: z.number().min(0).max(1).optional(),
  subject_from_first_line: z.boolean().optional(),
});

const createConditionSchema = z.object({
  column_name: z.string().min(1),
  operator: z.enum(['equals', 'contains', 'is_empty']),
  value: z.string().default(''),
});

const updateConditionSchema = z.object({
  column_name: z.string().min(1).optional(),
  operator: z.enum(['equals', 'contains', 'is_empty']).optional(),
  value: z.string().optional(),
});

// GET /api/sequences/:sequenceId/templates - List templates for a sequence
router.get('/sequences/:sequenceId/templates', async (req, res, next) => {
  try {
    const { sequenceId } = req.params;

    const templatesResult = await query(
      `SELECT id, sequence_id, is_default, subject, body, prompt, use_ai, ai_model, ai_temperature, subject_from_first_line, created_at, updated_at
       FROM templates WHERE sequence_id = ? ORDER BY is_default DESC, created_at`,
      [sequenceId]
    );

    // Fetch conditions for each template
    for (const template of templatesResult.rows) {
      const conditionsResult = await query(
        'SELECT id, template_id, column_name, operator, value, condition_order, created_at FROM conditions WHERE template_id = ? ORDER BY condition_order',
        [template.id]
      );
      template.conditions = conditionsResult.rows;
    }

    res.json(templatesResult.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/sequences/:sequenceId/templates - Create a new template
router.post('/sequences/:sequenceId/templates', async (req, res, next) => {
  try {
    const { sequenceId } = req.params;
    const data = createTemplateSchema.parse(req.body);

    // If this is a default template, check if one already exists
    if (data.is_default) {
      const existing = await query(
        'SELECT id FROM templates WHERE sequence_id = ? AND is_default = 1',
        [sequenceId]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'A default template already exists for this sequence' } });
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const result = await query(
      `INSERT INTO templates (id, sequence_id, is_default, subject, body, prompt, use_ai, ai_model, ai_temperature, subject_from_first_line, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id, sequence_id, is_default, subject, body, prompt, use_ai, ai_model, ai_temperature, subject_from_first_line, created_at, updated_at`,
      [id, sequenceId, data.is_default ? 1 : 0, data.subject, data.body, data.prompt, data.use_ai ? 1 : 0, data.ai_model, data.ai_temperature, data.subject_from_first_line ? 1 : 0, now, now]
    );

    const template = result.rows[0];
    template.conditions = [];
    res.status(201).json(template);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
    }
    next(err);
  }
});

// PATCH /api/templates/:id - Update a template
router.patch('/templates/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateTemplateSchema.parse(req.body);

    const fields = [];
    const values = [];

    const allowedFields = ['subject', 'body', 'prompt', 'use_ai', 'ai_model', 'ai_temperature', 'subject_from_first_line'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field] === true ? 1 : data[field] === false ? 0 : data[field]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } });
    }

    fields.push(`updated_at = ?`);
    values.push(new Date().toISOString());
    values.push(id);

    const result = await query(
      `UPDATE templates SET ${fields.join(', ')} WHERE id = ? RETURNING id, sequence_id, is_default, subject, body, prompt, use_ai, ai_model, ai_temperature, subject_from_first_line, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }

    const template = result.rows[0];
    const conditionsResult = await query(
      'SELECT id, template_id, column_name, operator, value, condition_order, created_at FROM conditions WHERE template_id = ? ORDER BY condition_order',
      [template.id]
    );
    template.conditions = conditionsResult.rows;

    res.json(template);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
    }
    next(err);
  }
});

// DELETE /api/templates/:id - Delete a template
router.delete('/templates/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if it's a default template
    const template = await query('SELECT is_default FROM templates WHERE id = ?', [id]);
    if (template.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }

    if (template.rows[0].is_default) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Cannot delete the default template' } });
    }

    await query('DELETE FROM templates WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/templates/:templateId/conditions - Add a condition to a template
router.post('/templates/:templateId/conditions', async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const data = createConditionSchema.parse(req.body);

    // Get the next condition_order
    const maxOrderResult = await query(
      'SELECT COALESCE(MAX(condition_order), 0) as max_order FROM conditions WHERE template_id = ?',
      [templateId]
    );
    const nextOrder = parseInt(maxOrderResult.rows[0].max_order) + 1;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const result = await query(
      'INSERT INTO conditions (id, template_id, column_name, operator, value, condition_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, template_id, column_name, operator, value, condition_order, created_at',
      [id, templateId, data.column_name, data.operator, data.value, nextOrder, now]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
    }
    next(err);
  }
});

// PATCH /api/conditions/:id - Update a condition
router.patch('/conditions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateConditionSchema.parse(req.body);

    const fields = [];
    const values = [];

    const allowedFields = ['column_name', 'operator', 'value'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } });
    }

    values.push(id);

    const result = await query(
      `UPDATE conditions SET ${fields.join(', ')} WHERE id = ? RETURNING id, template_id, column_name, operator, value, condition_order, created_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Condition not found' } });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
    }
    next(err);
  }
});

// DELETE /api/conditions/:id - Delete a condition
router.delete('/conditions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM conditions WHERE id = ?', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Condition not found' } });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;