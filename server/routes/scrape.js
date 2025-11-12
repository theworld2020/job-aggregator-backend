// server/routes/scrape.js
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const scrapeFromSites = require('../scrapers');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const SECRET = process.env.SCRAPE_SECRET || null;

router.get('/test', (req, res) => res.send('✅ Scrape router is working'));

// Main scrape endpoint
router.post('/', async (req, res) => {
  // Secret check (if SCRAPE_SECRET is configured)
  if (SECRET) {
    const incoming = req.get('x-scrape-secret');
    if (!incoming || incoming !== SECRET) {
      console.warn('Forbidden: invalid/missing SCRAPE_SECRET');
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  const { roles, city, sites } = req.body || {};
  if (!roles || !Array.isArray(roles) || roles.length === 0 || !sites || !Array.isArray(sites) || sites.length === 0) {
    return res.status(400).json({ error: 'Please provide roles (array) and sites (array)' });
  }

  console.log(`🧠 Scrape request: roles=${roles.join(', ')} city=${city || 'N/A'} sites=${sites.join(', ')}`);

  try {
    const allResults = await scrapeFromSites(sites, roles, city);

    let inserted = 0;
    for (const job of allResults) {
      try {
        // Deduplicate: skip if same company (case-insensitive) and exact posted_date exists
        const checkRes = await pool.query(
          `SELECT id FROM jobs WHERE lower(company) = lower($1) AND posted_date = $2 LIMIT 1`,
          [job.company || '', job.posted_date || null]
        );

        if (checkRes.rowCount > 0) {
          // skip - duplicate
          continue;
        }

        // Insert
        await pool.query(
          `INSERT INTO jobs (title, company, location, url, source, posted_date, days_ago, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (url) DO NOTHING`,
          [job.title || '', job.company || '', job.location || '', job.url || '', job.source || '', job.posted_date || null, job.days_ago || 0]
        );
        inserted++;
      } catch (e) {
        console.error('❌ Failed to insert job:', e.message);
      }
    }

    console.log(`✅ Scrape complete. Inserted ${inserted} new jobs.`);
    return res.json({ inserted });
  } catch (err) {
    console.error('❌ Scrape route failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
