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

// 🧩 Main scrape endpoint (Cronhooks-compatible)
router.post('/', async (req, res) => {
  let { roles, city, sites } = req.body || {};

  // 🟢 Default roles (your REAL target)
  roles = Array.isArray(roles) && roles.length > 0
    ? roles
    : [
        'Product Manager',
        'Product Owner',
        'Senior Product Owner',
        'Senior Product Manager'
      ];

  // 🟢 Default city
  city = city || 'Bangalore';

  // 🟢 Default sites
  sites = Array.isArray(sites) && sites.length > 0
    ? sites
    : ['linkedin', 'instahyre', 'naukri'];

  console.log(`
==============================
🕓 Cron / Manual Scrape Triggered
Roles: ${roles.join(', ')}
City: ${city}
Sites: ${sites.join(', ')}
Time: ${new Date().toISOString()}
==============================
  `);

  let totalInserted = 0;

  try {
    // Run scrapers (LinkedIn, Instahyre, Naukri)
    const allResults = await scrapeFromSites(sites, roles, city);

    console.log(`🔎 Total jobs fetched: ${allResults.length}`);

    for (const job of allResults) {
      try {
        await pool.query(
          `INSERT INTO jobs (title, company, location, url, source, posted_date, days_ago)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (url) DO NOTHING`,
          [
            job.title,
            job.company,
            job.location,
            job.url,
            job.source,
            job.posted_date,
            job.days_ago
          ]
        );
        totalInserted++;
      } catch (e) {
        console.error('❌ Insert error:', e.message);
      }
    }

    console.log(`✅ Inserted ${totalInserted} new product roles`);
    return res.json({ inserted: totalInserted });

  } catch (err) {
    console.error('❌ Scrape route failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
