// server/routes/sync.js
// Sync routes: push client changes and pull server changes.
// Expected JSON payload for push: { changes: [{ table, id, op, data }] }
// Pull endpoint expects a query param `since` (ISO timestamp).

const express = require('express');
const router = express.Router();
const pool = require('../db');

// Helper: upsert a row into a given table (simple implementation)
async function upsertRow(table, data) {
  const columns = Object.keys(data);
  const values = columns.map(col => data[col]);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
  const updateAssignments = columns.map((col, i) => `${col}=EXCLUDED.${col}`).join(',');
  const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})
               ON CONFLICT (id) DO UPDATE SET ${updateAssignments}`;
  await pool.query(sql, values);
}

// ------------------- PUSH -------------------
router.post('/push', async (req, res) => {
  const changes = req.body.changes;
  if (!Array.isArray(changes)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  try {
    for (const change of changes) {
      const { table, id, op, data } = change;
      if (op === 'delete') {
        await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
      } else { // upsert (create or update)
        // Ensure the row belongs to the authenticated user – enforce owner_id check
        const augmented = { ...data, owner_id: req.user.id };
        await upsertRow(table, augmented);
      }
    }
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Sync push error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------- PULL -------------------
router.get('/pull', async (req, res) => {
  const since = req.query.since;
  if (!since) {
    return res.status(400).json({ error: 'Missing since timestamp' });
  }
  try {
    // Pull all rows that belong to this user and have been modified after `since`
    // Assuming each table has a `last_updated` timestamp column.
    const tables = ['inventory_items', 'users']; // extend as needed
    const allChanges = [];
    for (const tbl of tables) {
      const result = await pool.query(
        `SELECT * FROM ${tbl} WHERE owner_id = $1 AND last_updated > $2`,
        [req.user.id, since]
      );
      result.rows.forEach(row => {
        allChanges.push({ table: tbl, id: row.id, op: 'upsert', data: row });
      });
    }
    res.json({ changes: allChanges });
  } catch (err) {
    console.error('Sync pull error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
