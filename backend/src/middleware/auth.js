// backend/src/middleware/auth.js — JWT verification, attaches req.user
import { verifyToken, COOKIE_NAME } from '../services/auth.js';

export function authMiddleware(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
  }

  req.user = { id: payload.userId };
  next();
}

export function optionalAuthMiddleware(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = { id: payload.userId };
    }
  }
  next();
}