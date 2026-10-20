// backend/src/routes/projects.js — Project CRUD API
import express from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { query } from '../db.js';

const router = express.Router();

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

// GET /api/projects - List all projects
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, name, created_at, updated_at FROM projects ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects - Create a new project
router.post('/', async (req, res, next) => {
  try {
    const data = createProjectSchema.parse(req.body);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const result = await query(
      'INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING id, name, created_at, updated_at',
      [id, data.name, now, now]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
    }
    next(err);
  }
});

// PATCH /api/projects/:id - Update a project
router.patch('/:id', async (req, res, next) => {
  try {
    const data = updateProjectSchema.parse(req.body);
    const { id } = req.params;

    const fields = [];
    const values = [];

    if (data.name !== undefined) {
      fields.push(`name = ?`);
      values.push(data.name);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } });
    }

    fields.push(`updated_at = ?`);
    values.push(new Date().toISOString());
    values.push(id);

    const result = await query(
      `UPDATE projects SET ${fields.join(', ')} WHERE id = ? RETURNING id, name, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
    }
    next(err);
  }
});

// DELETE /api/projects/:id - Delete a project (cascades to sequences, templates, contacts, generated_emails)
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM projects WHERE id = ?', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;