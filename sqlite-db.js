// sqlite-db.js
// Lightweight SQLite wrapper using better-sqlite3
// Provides the same `query(sql, params)` interface used by the existing PostgreSQL code.
// The database file lives in ./data/audit.sqlite (relative to project root).

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Ensure the data directory exists
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Path to the SQLite file (will be created automatically if missing)
const dbPath = path.join(dataDir, 'audit.sqlite');
const db = new Database(dbPath);

// Initialize schema if this is a fresh DB
function initSchema() {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      api_key TEXT NOT NULL,
      owner_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      serial_number TEXT,
      classification TEXT NOT NULL,
      qty INTEGER NOT NULL CHECK (qty >= 0),
      condition TEXT NOT NULL,
      custodian TEXT,
      barangay_id INTEGER NOT NULL,
      last_updated TEXT DEFAULT (datetime('now')),
      owner_id INTEGER NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      row_id INTEGER NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT,
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `;
  db.exec(schema);
}

initSchema();

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  if (/^\s*SELECT/i.test(sql)) {
    return stmt.all(params);
  }
  const info = stmt.run(params);
  return info;
}

module.exports = {
  query,
  raw: db
};
