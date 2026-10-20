// backend/src/db.js — SQLite connection and migration runner
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || './data/influencer_marketer.sqlite';

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

export function query(sql, params = []) {
  const start = Date.now();
  const stmt = db.prepare(sql);
  let result;
  
  if (sql.trim().toUpperCase().startsWith('SELECT')) {
    result = stmt.all(...params);
    return { rows: result, rowCount: result.length };
  } else {
    result = stmt.run(...params);
    return { 
      rows: [], 
      rowCount: result.changes,
      lastInsertRowid: result.lastInsertRowid 
    };
  }
}

export function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  const row = stmt.get(...params);
  return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
}

export function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Running ${files.length} migrations...`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`Applying ${file}...`);
    db.exec(sql);
    console.log(`Applied ${file}`);
  }

  console.log('All migrations applied successfully.');
}

export function close() {
  db.close();
}

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    migrate();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

export default db;