const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

let db;

function getDb() {
  if (db) return db;

  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    const sslConfig = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false };
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: sslConfig });
    db = pool;
    return db;
  }

  const Database = require('better-sqlite3');
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/jobs.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

const isPg = () => !!process.env.DATABASE_URL;

const USERS_SQLITE = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  resume_text TEXT,
  resume_filename TEXT,
  candidate_profile TEXT,
  preferred_roles TEXT,
  suggested_roles TEXT,
  setup_complete INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`;

const USERS_PG = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  resume_text TEXT,
  resume_filename TEXT,
  candidate_profile TEXT,
  preferred_roles TEXT,
  suggested_roles TEXT,
  setup_complete INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
)`;

const JOBS_SQLITE = `
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  salary TEXT,
  description TEXT,
  apply_url TEXT,
  source TEXT,
  match_score INTEGER,
  match_reason TEXT,
  cover_letter TEXT,
  applied INTEGER DEFAULT 0,
  applied_at TEXT,
  fetched_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(external_id, user_id)
)`;

const JOBS_PG = `
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  salary TEXT,
  description TEXT,
  apply_url TEXT,
  source TEXT,
  match_score INTEGER,
  match_reason TEXT,
  cover_letter TEXT,
  applied INTEGER DEFAULT 0,
  applied_at TEXT,
  fetched_date TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(external_id, user_id)
)`;

const TOPICS_SQLITE = `
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT UNIQUE,
  topic TEXT,
  category TEXT DEFAULT 'HLD',
  description TEXT,
  key_points TEXT
)`;

const TOPICS_PG = `
CREATE TABLE IF NOT EXISTS topics (
  id SERIAL PRIMARY KEY,
  date TEXT UNIQUE,
  topic TEXT,
  category TEXT DEFAULT 'HLD',
  description TEXT,
  key_points TEXT
)`;

async function initDb() {
  const database = getDb();

  if (isPg()) {
    await database.query(USERS_PG);
    await database.query(JOBS_PG);
    await database.query(TOPICS_PG);
    // Migrate existing topics table — add new columns if missing
    await database.query(`ALTER TABLE topics ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'HLD'`);
    await database.query(`ALTER TABLE topics ADD COLUMN IF NOT EXISTS key_points TEXT`);
    console.log('[DB] PostgreSQL tables ready');
  } else {
    database.exec(USERS_SQLITE);
    database.exec(JOBS_SQLITE);
    database.exec(TOPICS_SQLITE);
    console.log('[DB] SQLite tables ready at', process.env.DB_PATH || './data/jobs.db');
  }
}

module.exports = { getDb, initDb, isPg };
