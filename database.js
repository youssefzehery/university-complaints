'use strict';
/**
 * database.js — sql.js wrapper with automatic disk persistence.
 * Provides better-sqlite3-compatible synchronous API to routes.
 */

const fs      = require('fs');
const path    = require('path');
const bcrypt  = require('bcryptjs');

const DB_DIR  = process.env.NODE_ENV === 'production' ? '/data' : __dirname;
const DB_FILE = path.join(DB_DIR, 'complaints.db');

let _SQL;
let _db;
let _saveTimer;

function resultToRows(result) {
  if (!result || !result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

function scheduleSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveToDisk, 200);
}

function saveToDisk() {
  if (!_db) return;
  try {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, Buffer.from(_db.export()));
  } catch (e) {
    console.error('[DB] Save error:', e.message);
  }
}

async function initDB() {
  const initSqlJs = require('sql.js');
  _SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const buf = fs.readFileSync(DB_FILE);
    _db = new _SQL.Database(buf);
    console.log('[DB] Loaded existing database from: ' + DB_FILE);
  } else {
    _db = new _SQL.Database();
    console.log('[DB] Created new database at: ' + DB_FILE);
  }

  _db.run('PRAGMA foreign_keys = ON;');

  _db.run(`CREATE TABLE IF NOT EXISTS complaints (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_number    TEXT    UNIQUE NOT NULL,
    student_name        TEXT    NOT NULL,
    student_code        TEXT    NOT NULL,
    student_mobile      TEXT    NOT NULL,
    student_national_id TEXT,
    complaint_type      TEXT    DEFAULT 'general',
    subject             TEXT    NOT NULL,
    content             TEXT    NOT NULL,
    status              TEXT    DEFAULT 'new',
    admin_response      TEXT,
    responded_by        TEXT,
    submitted_at        TEXT    DEFAULT (datetime('now','localtime')),
    updated_at          TEXT    DEFAULT (datetime('now','localtime'))
  );`);

  _db.run(`CREATE TABLE IF NOT EXISTS complaint_history (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id  INTEGER NOT NULL,
    action        TEXT    NOT NULL,
    note          TEXT,
    old_status    TEXT,
    new_status    TEXT,
    performed_by  TEXT,
    performed_at  TEXT    DEFAULT (datetime('now','localtime'))
  );`);

  _db.run(`CREATE TABLE IF NOT EXISTS admin_users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    username      TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    role          TEXT    DEFAULT 'admin',
    is_active     INTEGER DEFAULT 1,
    created_at    TEXT    DEFAULT (datetime('now','localtime')),
    last_login    TEXT
  );`);

  _db.run(`CREATE TABLE IF NOT EXISTS complaint_counter (
    id    INTEGER PRIMARY KEY,
    value INTEGER DEFAULT 0
  );`);

  _db.run(`INSERT OR IGNORE INTO complaint_counter (id, value) VALUES (1, 0);`);

  const devRows = resultToRows(
    _db.exec(`SELECT id FROM admin_users WHERE role = 'developer' LIMIT 1`)
  );
  if (!devRows.length) {
    const devPass = process.env.DEV_PASSWORD || 'dev@2024';
    const hash    = bcrypt.hashSync(devPass, 10);
    _db.run(
      `INSERT INTO admin_users (name, username, password_hash, role) VALUES (?,?,?,'developer')`,
      ['مدير النظام', 'dev', hash]
    );
    console.log('[DB] Developer account created: dev / ' + devPass);
  }

  saveToDisk();
  console.log('[DB] Database ready ✅');
}

function getDB() {
  if (!_db) throw new Error('[DB] Not initialised — call initDB() first');

  return {
    exec(sql) {
      _db.run(sql);
      scheduleSave();
    },
    pragma() {},

    prepare(sql) {
      return {
        run(...args) {
          const params = Array.isArray(args[0]) ? args[0] : args;
          _db.run(sql, params);
          const idR = resultToRows(_db.exec('SELECT last_insert_rowid() AS id'));
          const cR  = resultToRows(_db.exec('SELECT changes() AS c'));
          scheduleSave();
          return { lastInsertRowid: idR[0]?.id ?? 0, changes: cR[0]?.c ?? 0 };
        },

        get(...args) {
          const params = Array.isArray(args[0]) ? args[0] : args;
          const stmt = _db.prepare(sql);
          stmt.bind(params);
          const row = stmt.step() ? stmt.getAsObject() : undefined;
          stmt.free();
          return row;
        },

        all(...args) {
          const params = Array.isArray(args[0]) ? args[0] : args;
          const stmt = _db.prepare(sql);
          stmt.bind(params);
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
      };
    },
  };
}

function getNextComplaintNumber() {
  const db = getDB();
  db.prepare(`UPDATE complaint_counter SET value = value + 1 WHERE id = 1`).run();
  const row = db.prepare(`SELECT value FROM complaint_counter WHERE id = 1`).get();
  return String(row?.value ?? 1).padStart(6, '0');
}

module.exports = { getDB, initDB, getNextComplaintNumber };
