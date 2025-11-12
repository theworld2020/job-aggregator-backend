const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const scrapeFromSites = require('../scrapers');
require('dotenv').config();

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 🧠 Test route
router.get('/test', (req, res) => {
  res.send('✅ Scrape router is working');
});

// 🧩 Main scrape endpoint
router.post('/', async (req, res) => {
  const { roles, city, sites } = req.body;

  if (!roles || !Array.isArray(roles) || roles.length === 0 || !sites || sites.length === 0) {
    return res.status(400).json({ error: 'Please provide at least one role and one site' });
  }

  console.log(`🧠 Scrape request received: roles=${roles.join(', ')} city=${city || 'N/A'} sites=${sites.join(', ')}`);

  let totalInserted = 0;

  try {
    const allResults = await scrapeFromSites(sites, roles, city);

    for (const job of allResults) {
      try {
        await pool.query(
          `INSERT INTO jobs (title, company, location, url, source, posted_date, days_ago)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (url) DO NOTHING`,
          [job.title, job.company, job.location, job.url, job.source, job.posted_date, job.days_ago]
        );
        totalInserted++;
      } catch (e) {
        console.error('❌ Failed to insert job:', e.message);
      }
    }

    console.log(`✅ Inserted ${totalInserted} new jobs into database`);
    res.json({ inserted: totalInserted });
  } catch (err) {
    console.error('❌ Scrape route failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
