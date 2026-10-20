// backend/src/db.js — PostgreSQL connection pool and migration runner
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Handle pool errors to prevent unhandled rejections
pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
  return res;
}

export async function getClient() {
  return pool.connect();
}

export async function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Running ${files.length} migrations...`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`Applying ${file}...`);
    await query(sql);
    console.log(`Applied ${file}`);
  }

  console.log('All migrations applied successfully.');
}

export async function close() {
  await pool.end();
}

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

export default pool;