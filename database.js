// database.js
// Centralized Secure PostgreSQL Relational Data Module

const { Pool } = require('pg');
require('dotenv').config();

// Create connection pooling client referencing local or remote environment configs.
// Variables resides in .env:
// - DATABASE_URL: Contains host, user, database name, password, and port in a single connection URI.
// E.g. DATABASE_URL="postgresql://postgres:gelo0311@localhost:5432/sr_audit"
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:gelo0311@localhost:5432/sr_audit';

const pool = new Pool({
  connectionString,
  // Secure SSL configuration enabled for remote database endpoints (neon, render, supabase)
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 15, // Maximum size of PostgreSQL connection pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Logs status update to console on connection pool ready
pool.on('connect', () => {
  console.log('Successfully connected to the PostgreSQL database cluster.');
});

pool.on('error', (err) => {
  console.error('Unexpected database client connection pool failure:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
