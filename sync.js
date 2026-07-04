// sync.js
// Simple offline‑first sync service (push & pull) using fetch
// This module is imported by the renderer or main process when network status changes.

const path = require('path');
const fs = require('fs');
const sqlite = require('./sqlite-db');

// Load config from .env (already loaded by database.js)
const REMOTE_URL = process.env.REMOTE_URL;
const REMOTE_API_KEY = process.env.REMOTE_API_KEY;

function isOnline() {
  // Quick DNS check – resolves google.com; works on Windows
  const dns = require('dns');
  return new Promise(resolve => {
    dns.resolve('google.com', err => resolve(!err));
  });
}

async function pushChanges() {
  const pending = sqlite.query('SELECT * FROM sync_queue WHERE synced = 0');
  if (pending.length === 0) return;

  const payload = pending.map(r => ({
    table: r.table_name,
    id: r.row_id,
    op: r.operation,
    data: JSON.parse(r.payload)
  }));

  try {
    const resp = await fetch(`${REMOTE_URL}/api/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': REMOTE_API_KEY
      },
      body: JSON.stringify({ changes: payload })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    // Mark rows as synced
    const ids = pending.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    sqlite.query(`UPDATE sync_queue SET synced = 1 WHERE id IN (${placeholders})`, ids);
    console.log('✅ Sync push completed');
  } catch (e) {
    console.error('❌ Sync push failed:', e.message);
  }
}

async function pullChanges(lastSyncTimestamp) {
  try {
    const resp = await fetch(`${REMOTE_URL}/api/sync/pull?since=${encodeURIComponent(lastSyncTimestamp)}`, {
      headers: { 'X-API-KEY': REMOTE_API_KEY }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const { changes } = await resp.json();
    for (const c of changes) {
      // Simple upsert – replace existing row with same primary key
      const cols = Object.keys(c.data);
      const values = cols.map(k => c.data[k]);
      const placeholders = cols.map(() => '?').join(',');
      const sql = `INSERT OR REPLACE INTO ${c.table} (${cols.join(',')}) VALUES (${placeholders})`;
      sqlite.query(sql, values);
    }
    console.log('✅ Sync pull completed');
  } catch (e) {
    console.error('❌ Sync pull failed:', e.message);
  }
}

async function runSync() {
  const online = await isOnline();
  if (!online) return;
  const lastSync = fs.existsSync(path.resolve(__dirname, 'last_sync.txt'))
    ? fs.readFileSync(path.resolve(__dirname, 'last_sync.txt'), 'utf8')
    : new Date(0).toISOString();
  await pushChanges();
  await pullChanges(lastSync);
  fs.writeFileSync(path.resolve(__dirname, 'last_sync.txt'), new Date().toISOString());
}

module.exports = { runSync };
