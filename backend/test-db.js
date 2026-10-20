const Database = require('better-sqlite3');
const db = new Database('./data/influencer_marketer.sqlite');
console.log('Tables:');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
tables.forEach(t => console.log(' -', t.name));
console.log('\nUsers table schema:');
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
console.log(schema.sql);