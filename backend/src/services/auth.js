// backend/src/services/auth.js — Password hashing, JWT, API key encryption (AES-256-GCM)
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, queryOne } from '../db.js';

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

// Derive a 32-byte key from ENCRYPTION_KEY using SHA-256
const ENCRYPTION_KEY_BUFFER = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();

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

// --- API Key Encryption (AES-256-GCM) ---
// Format: iv (12 bytes) + ciphertext + authTag (16 bytes) -> base64

export function encryptApiKey(apiKey) {
  if (!apiKey) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY_BUFFER, iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Combine: iv + ciphertext + authTag
  const combined = Buffer.concat([iv, ciphertext, authTag]);
  return combined.toString('base64');
}

export function decryptApiKey(encrypted) {
  if (!encrypted) return null;
  try {
    const combined = Buffer.from(encrypted, 'base64');
    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(-16);
    const ciphertext = combined.subarray(12, -16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY_BUFFER, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } catch (err) {
    console.error('Failed to decrypt API key:', err.message);
    return null;
  }
}

// --- User & Settings DB ---

export async function createUser(email, passwordHash) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await query(
    `INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [id, email.toLowerCase(), passwordHash, now, now]
  );
  // Create default settings
  await query(
    `INSERT INTO user_settings (user_id, created_at, updated_at) VALUES (?, ?, ?)`,
    [id, now, now]
  );
  return { id, email: email.toLowerCase(), created_at: now, updated_at: now };
}

export async function findUserByEmail(email) {
  const result = await queryOne(
    `SELECT id, email, password_hash, created_at, updated_at FROM users WHERE email = ?`,
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
}

export async function findUserById(id) {
  const result = await queryOne(
    `SELECT id, email, created_at, updated_at FROM users WHERE id = ?`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getUserSettings(userId) {
  const result = await queryOne(
    `SELECT user_id, gemini_api_key_encrypted, default_ai_model, default_ai_temperature, created_at, updated_at
     FROM user_settings WHERE user_id = ?`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function updateUserSettings(userId, { geminiApiKey, defaultAiModel, defaultAiTemperature }) {
  const fields = [];
  const values = [];

  if (geminiApiKey !== undefined) {
    const encrypted = encryptApiKey(geminiApiKey);
    fields.push(`gemini_api_key_encrypted = ?`);
    values.push(encrypted);
  }
  if (defaultAiModel !== undefined) {
    fields.push(`default_ai_model = ?`);
    values.push(defaultAiModel);
  }
  if (defaultAiTemperature !== undefined) {
    fields.push(`default_ai_temperature = ?`);
    values.push(defaultAiTemperature);
  }

  if (fields.length === 0) {
    return getUserSettings(userId);
  }

  fields.push(`updated_at = ?`);
  values.push(new Date().toISOString());
  values.push(userId);

  await query(
    `UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = ?`,
    values
  );
  return getUserSettings(userId);
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