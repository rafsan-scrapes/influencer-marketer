// backend/src/routes/ai.js — Gemini Proxy Endpoint
import express from 'express';
import { z } from 'zod';
import { generateContent } from '../services/gemini.js';

const router = express.Router();

const generateSchema = z.object({
  model: z.string().default('gemini-1.5-flash'),
  temperature: z.number().min(0).max(1).default(0.3),
  systemPrompt: z.string().optional(),
  userPrompt: z.string().min(1),
});

// POST /api/ai/generate - Generate content using Gemini
router.post('/ai/generate', async (req, res, next) => {
  try {
    const data = generateSchema.parse(req.body);

    const content = await generateContent({
      model: data.model,
      temperature: data.temperature,
      systemPrompt: data.systemPrompt,
      userPrompt: data.userPrompt,
    });

    res.json({ content });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
    }
    console.error('Gemini generation error:', err);
    res.status(500).json({ error: { code: 'AI_GENERATION_ERROR', message: err.message } });
  }
});

export default router;