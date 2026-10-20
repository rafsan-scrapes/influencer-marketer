// backend/src/routes/sequences.js — Sequence CRUD API
import express from 'express';
import { z } from 'zod';
import { query } from '../db.js';

const router = express.Router();

const createSequenceSchema = z.object({
  name: z.string().min(1).max(255).default('Sequence'),
});

const updateSequenceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

// GET /api/projects/:projectId/sequences - List sequences for a project
router.get('/projects/:projectId/sequences', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const result = await query(
      'SELECT id, project_id, name, step_order, created_at FROM sequences WHERE project_id = $1 ORDER BY step_order',
      [projectId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/sequences - Create a new sequence
router.post('/projects/:projectId/sequences', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const data = createSequenceSchema.parse(req.body);

    // Get the next step_order
    const maxOrderResult = await query(
      'SELECT COALESCE(MAX(step_order), 0) as max_order FROM sequences WHERE project_id = $1',
      [projectId]
    );
    const nextOrder = parseInt(maxOrderResult.rows[0].max_order) + 1;

    const result = await query(
      'INSERT INTO sequences (project_id, name, step_order) VALUES ($1, $2, $3) RETURNING id, project_id, name, step_order, created_at',
      [projectId, data.name, nextOrder]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
    }
    next(err);
  }
});

// PATCH /api/projects/:projectId/sequences/:id - Update a sequence
router.patch('/projects/:projectId/sequences/:id', async (req, res, next) => {
  try {
    const { projectId, id } = req.params;
    const data = updateSequenceSchema.parse(req.body);

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } });
    }

    values.push(id, projectId);

    const result = await query(
      `UPDATE sequences SET ${fields.join(', ')} WHERE id = $${paramIndex} AND project_id = $${paramIndex + 1} RETURNING id, project_id, name, step_order, created_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Sequence not found' } });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
    }
    next(err);
  }
});

// DELETE /api/projects/:projectId/sequences/:id - Delete a sequence
router.delete('/projects/:projectId/sequences/:id', async (req, res, next) => {
  try {
    const { projectId, id } = req.params;

    // Get the step_order of the sequence being deleted
    const deletedSeq = await query(
      'SELECT step_order FROM sequences WHERE id = $1 AND project_id = $2',
      [id, projectId]
    );

    if (deletedSeq.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Sequence not found' } });
    }

    const deletedOrder = deletedSeq.rows[0].step_order;

    // Delete the sequence (cascades to templates, conditions)
    await query('DELETE FROM sequences WHERE id = $1 AND project_id = $2', [id, projectId]);

    // Decrement step_order for sequences after the deleted one
    await query(
      'UPDATE sequences SET step_order = step_order - 1 WHERE project_id = $1 AND step_order > $2',
      [projectId, deletedOrder]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/sequences/reorder - Reorder sequences
router.post('/projects/:projectId/sequences/reorder', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const data = reorderSchema.parse(req.body);

    // Verify all sequences belong to this project
    const placeholders = data.ids.map((_, i) => `$${i + 1}`).join(',');
    const checkResult = await query(
      `SELECT id FROM sequences WHERE id IN (${placeholders}) AND project_id = $${data.ids.length + 1}`,
      [...data.ids, projectId]
    );

    if (checkResult.rows.length !== data.ids.length) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'One or more sequences not found in this project' } });
    }

    // Update step_order for each sequence
    for (let i = 0; i < data.ids.length; i++) {
      await query(
        'UPDATE sequences SET step_order = $1 WHERE id = $2 AND project_id = $3',
        [i + 1, data.ids[i], projectId]
      );
    }

    // Return updated sequences
    const result = await query(
      'SELECT id, project_id, name, step_order, created_at FROM sequences WHERE project_id = $1 ORDER BY step_order',
      [projectId]
    );

    res.json(result.rows);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
    }
    next(err);
  }
});

export default router;