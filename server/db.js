// server/db.js
// Simple PostgreSQL pool for the remote sync API (separate from the Electron app)
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

module.exports = pool;
