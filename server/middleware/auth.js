// server/middleware/auth.js
// Simple API‑key authentication middleware for the sync server.
// It expects the client to send `X-API-KEY` header. The key is looked up
// in the `users` table (column `api_key`). If a matching user is found,
// `req.user` is populated with the user record; otherwise a 401 response is sent.

const pool = require('../db');

async function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key' });
  }
  try {
    const result = await pool.query('SELECT id, username FROM users WHERE api_key = $1', [apiKey]);
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    // Attach user info for downstream handlers
    req.user = result.rows[0];
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = authMiddleware;
