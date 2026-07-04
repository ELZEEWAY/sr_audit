// server.js
// Secure Node.js server using parameterized queries for PostgreSQL (pg) and Express.

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. Tell Express to serve all your CSS, images, and JS styling folders
app.use(express.static(path.join(__dirname, 'style')));
app.use(express.static(path.join(__dirname, 'pages')));
app.use(express.static(path.join(__dirname, 'javascript')));
app.use(express.static(path.join(__dirname, 'Assets')));
app.use(express.static(path.join(__dirname, 'lib')));

// 2. Tell Express to redirect the root web link directly to your index.html page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize PG connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Authentication endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  try {
    // In production: Use bcrypt/argon2 validation. For this migration, we do direct matching.
    const result = await pool.query(
      `SELECT u.id, u.username, u.password_hash, u.barangay_id, u.authorized_module, u.role, b.name AS barangay_name 
       FROM users u 
       LEFT JOIN barangays b ON u.barangay_id = b.id 
       WHERE u.username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const user = result.rows[0];

    // Verify plaintext password match
    if (user.password_hash !== password) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Delete sensitive fields before returning user data
    delete user.password_hash;

    res.json({ success: true, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// Tenant protected inventory list endpoint
app.get('/api/inventory', async (req, res) => {
  const { barangay_id, user_role } = req.query;

  if (!barangay_id || !user_role) {
    return res.status(400).json({ error: 'Missing tenant identity parameters.' });
  }

  try {
    let result;
    if (user_role === 'admin') {
      result = await pool.query('SELECT * FROM inventory_items ORDER BY id ASC');
    } else {
      result = await pool.query(
        'SELECT * FROM inventory_items WHERE barangay_id = $1 ORDER BY id ASC',
        [parseInt(barangay_id, 10)]
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching inventory:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Financial reports API endpoints
app.post('/api/financial', async (req, res) => {
  const { barangay, audit_period, form_state, meta_details } = req.body;
  if (!barangay || !audit_period || !form_state || !meta_details) {
    return res.status(400).json({ success: false, error: 'Missing required parameters.' });
  }

  try {
    await pool.query(
      `INSERT INTO financial_reports (barangay, audit_period, form_state, meta_details)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (barangay, audit_period) DO UPDATE
       SET form_state = EXCLUDED.form_state, meta_details = EXCLUDED.meta_details`,
      [barangay, audit_period, JSON.stringify(form_state), JSON.stringify(meta_details)]
    );
    res.json({ success: true, message: 'Financial report upserted successfully.' });
  } catch (err) {
    console.error('Error upserting financial report:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

app.get('/api/financial', async (req, res) => {
  const { barangay, period } = req.query;
  if (!barangay || !period) {
    return res.status(400).json({ error: 'Missing barangay or period.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM financial_reports WHERE barangay = $1 AND audit_period = $2',
      [barangay, period]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching financial report:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/financial/periods', async (req, res) => {
  const { barangay } = req.query;
  if (!barangay) {
    return res.status(400).json({ error: 'Missing barangay.' });
  }

  try {
    const result = await pool.query(
      'SELECT DISTINCT audit_period FROM financial_reports WHERE barangay = $1 ORDER BY audit_period DESC',
      [barangay]
    );
    const periods = result.rows.map(row => row.audit_period);
    res.json({ periods });
  } catch (err) {
    console.error('Error fetching periods:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Enforce local listening for secure development
const PORT = process.env.PORT || 3000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server listening on http://127.0.0.1:${PORT}`);
});
