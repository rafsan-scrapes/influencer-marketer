// backend/src/routes/settings.js — User settings: Gemini API key, defaults
import express from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { getUserSettings, updateUserSettings, getUserDecryptedApiKey, maskApiKey } from '../services/auth.js';

const router = express.Router();

const updateSettingsSchema = z.object({
  gemini_api_key: z.string().optional(),
  default_ai_model: z.string().optional(),
  default_ai_temperature: z.number().min(0).max(1).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field required',
});

// GET /api/settings
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const settings = await getUserSettings(req.user.id);
    if (!settings) {
      return res.json({
        default_ai_model: 'gemini-1.5-flash',
        default_ai_temperature: 0.3,
        gemini_api_key: 'Not set',
      });
    }

    const maskedKey = settings.gemini_api_key_encrypted
      ? 'sk-****'
      : 'Not set';

    res.json({
      default_ai_model: settings.default_ai_model,
      default_ai_temperature: Number(settings.default_ai_temperature),
      gemini_api_key: maskedKey,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/settings
router.patch('/', authMiddleware, async (req, res, next) => {
  try {
    const data = updateSettingsSchema.parse(req.body);

    const updated = await updateUserSettings(req.user.id, {
      geminiApiKey: data.gemini_api_key,
      defaultAiModel: data.default_ai_model,
      defaultAiTemperature: data.default_ai_temperature,
    });

    const maskedKey = updated.gemini_api_key_encrypted
      ? 'sk-****'
      : 'Not set';

    res.json({
      default_ai_model: updated.default_ai_model,
      default_ai_temperature: Number(updated.default_ai_temperature),
      gemini_api_key: maskedKey,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
    }
    next(err);
  }
});

export default router;