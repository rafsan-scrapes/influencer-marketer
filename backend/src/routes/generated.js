// backend/src/routes/generated.js — Generated Emails API
import express from 'express';
import { z } from 'zod';
import { query } from '../db.js';

const router = express.Router();

const listQuerySchema = z.object({
  sequenceId: z.string().uuid().optional(),
  status: z.enum(['pending', 'generated', 'skipped', 'error']).optional(),
  contactId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// GET /api/projects/:projectId/generated-emails - List generated emails for a project
router.get('/projects/:projectId/generated-emails', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const queryParams = listQuerySchema.parse(req.query);

    let whereClause = 'WHERE c.project_id = $1';
    const values = [projectId];
    let paramIndex = 2;

    if (queryParams.sequenceId) {
      whereClause += ` AND ge.sequence_id = $${paramIndex++}`;
      values.push(queryParams.sequenceId);
    }
    if (queryParams.status) {
      whereClause += ` AND ge.status = $${paramIndex++}`;
      values.push(queryParams.status);
    }
    if (queryParams.contactId) {
      whereClause += ` AND ge.contact_id = $${paramIndex++}`;
      values.push(queryParams.contactId);
    }

    values.push(queryParams.limit, queryParams.offset);

    const result = await query(
      `SELECT ge.id, ge.contact_id, ge.sequence_id, ge.subject, ge.body, ge.status, ge.ai_used, ge.error_message, ge.generated_at,
              c.email as contact_email, c.csv_data as contact_data,
              s.name as sequence_name, s.step_order as sequence_step
       FROM generated_emails ge
       JOIN contacts c ON ge.contact_id = c.id
       JOIN sequences s ON ge.sequence_id = s.id
       ${whereClause}
       ORDER BY ge.generated_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values
    );

    const emails = result.rows.map(r => ({
      ...r,
      contact_data: typeof r.contact_data === 'string' ? JSON.parse(r.contact_data) : r.contact_data,
    }));

    res.json(emails);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: err.flatten() } });
    }
    next(err);
  }
});

// DELETE /api/generated-emails/:id - Delete a generated email
router.delete('/generated-emails/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM generated_emails WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Generated email not found' } });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;