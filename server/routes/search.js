const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

// ✅ PostgreSQL pool connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 🧠 Test route
router.get('/test', (req, res) => {
  res.send('✅ Search router is working');
});

// 🧩 Main search endpoint
router.get('/', async (req, res) => {
  const { roles, city, days } = req.query;

  let query = `
    SELECT id, title, company, location, url, source, posted_date, created_at
    FROM jobs
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  // 🔍 Filter by role (supports multiple roles, comma-separated)
  if (roles) {
    const roleList = roles.split(',').map(r => `%${r.trim()}%`);
    const roleConditions = roleList.map((_, i) => `title ILIKE $${paramIndex + i}`).join(' OR ');
    query += ` AND (${roleConditions})`;
    params.push(...roleList);
    paramIndex += roleList.length;
  }

  // 📍 Filter by city
  if (city) {
    query += ` AND location ILIKE $${paramIndex}`;
    params.push(`%${city}%`);
    paramIndex++;
  }

  // 🗓️ Filter by days (e.g. last 7 days)
  if (days) {
    query += ` AND created_at >= NOW() - INTERVAL '${days} days'`;
  }

  // 🔢 Order and limit
  query += ' ORDER BY created_at DESC LIMIT 50';

  try {
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('❌ Search query failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
