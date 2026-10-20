// backend/src/services/auth.js — Password hashing, JWT, API key encryption
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 chars for AES-256
const JWT_EXPIRY = '7d';
const COOKIE_NAME = 'auth_token';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
}

// --- Password ---

export async function hashPassword(password) {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// --- JWT ---

export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

// --- API Key Encryption (AES-256-GCM via pgcrypto or app-level) ---
// Using pgcrypto's pgp_sym_encrypt/decrypt with a key derived from ENCRYPTION_KEY

export async function encryptApiKey(apiKey) {
  if (!apiKey) return null;
  const result = await query(
    `SELECT pgp_sym_encrypt($1, $2) as encrypted`,
    [apiKey, ENCRYPTION_KEY]
  );
  return result.rows[0].encrypted;
}

export async function decryptApiKey(encrypted) {
  if (!encrypted) return null;
  const result = await query(
    `SELECT pgp_sym_decrypt($1, $2) as decrypted`,
    [encrypted, ENCRYPTION_KEY]
  );
  return result.rows[0].decrypted;
}

// --- User & Settings DB ---

export async function createUser(email, passwordHash) {
  const result = await query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2)
     RETURNING id, email, created_at, updated_at`,
    [email.toLowerCase(), passwordHash]
  );
  const user = result.rows[0];
  // Create default settings
  await query(
    `INSERT INTO user_settings (user_id) VALUES ($1)`,
    [user.id]
  );
  return user;
}

export async function findUserByEmail(email) {
  const result = await query(
    `SELECT id, email, password_hash, created_at, updated_at
     FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
}

export async function findUserById(id) {
  const result = await query(
    `SELECT id, email, created_at, updated_at
     FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getUserSettings(userId) {
  const result = await query(
    `SELECT user_id, gemini_api_key_encrypted, default_ai_model, default_ai_temperature, created_at, updated_at
     FROM user_settings WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function updateUserSettings(userId, { geminiApiKey, defaultAiModel, defaultAiTemperature }) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (geminiApiKey !== undefined) {
    const encrypted = await encryptApiKey(geminiApiKey);
    fields.push(`gemini_api_key_encrypted = $${paramIndex++}`);
    values.push(encrypted);
  }
  if (defaultAiModel !== undefined) {
    fields.push(`default_ai_model = $${paramIndex++}`);
    values.push(defaultAiModel);
  }
  if (defaultAiTemperature !== undefined) {
    fields.push(`default_ai_temperature = $${paramIndex++}`);
    values.push(defaultAiTemperature);
  }

  if (fields.length === 0) {
    return getUserSettings(userId);
  }

  fields.push(`updated_at = NOW()`);
  values.push(userId);

  const result = await query(
    `UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = $${paramIndex}
     RETURNING user_id, gemini_api_key_encrypted, default_ai_model, default_ai_temperature, created_at, updated_at`,
    values
  );
  return result.rows[0];
}

export async function getUserDecryptedApiKey(userId) {
  const settings = await getUserSettings(userId);
  if (!settings || !settings.gemini_api_key_encrypted) return null;
  return decryptApiKey(settings.gemini_api_key_encrypted);
}

export async function maskApiKey(apiKey) {
  if (!apiKey || apiKey.length < 8) return 'Not set';
  return `sk-****${apiKey.slice(-4)}`;
}

export { COOKIE_NAME };