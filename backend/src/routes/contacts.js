// backend/src/routes/contacts.js — Contact/CSV Import API
import express from 'express';
import { z } from 'zod';
import { importContacts, getContacts, updateContactSequenceStep } from '../services/csvImport.js';

const router = express.Router();

const importSchema = z.object({
  headers: z.array(z.string()).min(1),
  rows: z.array(z.record(z.string())).min(1),
});

const updateStepSchema = z.object({
  step: z.number().int().min(1),
});

// POST /api/projects/:projectId/contacts/import - Bulk import contacts from CSV
router.post('/projects/:projectId/contacts/import', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const data = importSchema.parse(req.body);

    const result = await importContacts(projectId, data.headers, data.rows);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
    }
    if (err.message.includes('email is required') || err.message.includes('must contain an "email" column')) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
    }
    next(err);
  }
});

// GET /api/projects/:projectId/contacts - List contacts for a project
router.get('/projects/:projectId/contacts', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const contacts = await getContacts(projectId);
    res.json(contacts);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/contacts/:id/sequence-step - Update a contact's current sequence step
router.patch('/contacts/:id/sequence-step', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateStepSchema.parse(req.body);

    const contact = await updateContactSequenceStep(id, data.step);
    if (!contact) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact not found' } });
    }

    res.json(contact);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
    }
    next(err);
  }
});

export default router;