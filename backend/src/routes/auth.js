// backend/src/routes/auth.js — Auth endpoints: signup, login, me, logout
import express from 'express';
import { z } from 'zod';
import { hashPassword, verifyPassword, signToken, setAuthCookie, clearAuthCookie, createUser, findUserByEmail, findUserById, getUserSettings, maskApiKey } from '../services/auth.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /auth/signup
router.post('/signup', async (req, res, next) => {
  try {
    const data = signupSchema.parse(req.body);

    const existing = await findUserByEmail(data.email);
    if (existing) {
      return res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } });
    }

    const passwordHash = await hashPassword(data.password);
    const user = await createUser(data.email, passwordHash);

    const token = signToken(user.id);
    setAuthCookie(res, token);

    const settings = await getUserSettings(user.id);
    res.status(201).json({
      user: { id: user.id, email: user.email, created_at: user.created_at },
      settings: settings ? {
        default_ai_model: settings.default_ai_model,
        default_ai_temperature: settings.default_ai_temperature,
        gemini_api_key: await maskApiKey(null), // masked
      } : null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
    }
    next(err);
  }
});

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await findUserByEmail(data.email);
    if (!user) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }

    const valid = await verifyPassword(data.password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }

    const token = signToken(user.id);
    setAuthCookie(res, token);

    const settings = await getUserSettings(user.id);
    let maskedKey = 'Not set';
    if (settings?.gemini_api_key_encrypted) {
      // We don't decrypt here, just return masked
      maskedKey = 'sk-****';
    }

    res.json({
      user: { id: user.id, email: user.email, created_at: user.created_at },
      settings: settings ? {
        default_ai_model: settings.default_ai_model,
        default_ai_temperature: settings.default_ai_temperature,
        gemini_api_key: maskedKey,
      } : null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
    }
    next(err);
  }
});

// GET /auth/me
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    const settings = await getUserSettings(user.id);
    let maskedKey = 'Not set';
    if (settings?.gemini_api_key_encrypted) {
      maskedKey = 'sk-****';
    }

    res.json({
      user: { id: user.id, email: user.email, created_at: user.created_at },
      settings: settings ? {
        default_ai_model: settings.default_ai_model,
        default_ai_temperature: settings.default_ai_temperature,
        gemini_api_key: maskedKey,
      } : null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

export default router;