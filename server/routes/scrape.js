const express = require("express");
const router = express.Router();
const { Pool } = require("pg");
require("dotenv").config();

// ✅ Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ Import all scrapers
const scrapeFromSites = require("../scrapers/index");

// ✅ Middleware for secret validation
router.use((req, res, next) => {
  const secret = req.headers["x-scrape-secret"];
  if (!secret || secret !== process.env.SCRAPE_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// ✅ POST /api/scrape
router.post("/", async (req, res) => {
  const { roles, city, sites } = req.body;
  console.log("🚀 Scrape triggered:", { roles, city, sites });

  try {
    let allResults = [];

    for (const site of sites) {
      const scraper = scrapeFromSites[site];
      if (scraper) {
        console.log(`🔍 Running scraper for ${site}...`);
        const jobs = await scraper(roles, city);
        allResults.push(...jobs);
      } else {
        console.warn(`⚠️ No scraper available for ${site}`);
      }
    }

    console.log(`📊 Scraped total ${allResults.length} job(s)`);

    let insertedCount = 0;

    for (const job of allResults) {
      if (!job.title) continue; // title is NOT NULL, skip if missing

      // ✅ Check for duplicates (same company + title + posted_date)
      const existing = await pool.query(
        `SELECT id FROM jobs 
         WHERE company = $1 
           AND title = $2 
           AND DATE(posted_date) = DATE($3)
         LIMIT 1`,
        [job.company, job.title, job.posted_date]
      );

      if (existing.rowCount === 0) {
        await pool.query(
          `INSERT INTO jobs 
           (title, company, location, source, url, posted_date, scraped_at, days_ago, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, NOW())`,
          [
            job.title,
            job.company,
            job.location,
            job.source,
            job.url,
            job.posted_date,
            job.days_ago || null,
          ]
        );
        insertedCount++;
      }
    }

    console.log(`✅ Inserted ${insertedCount} new job(s).`);
    res.json({ inserted: insertedCount, totalScraped: allResults.length });
  } catch (err) {
    console.error("❌ Scraper error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Test route
router.get("/test", (req, res) => {
  res.send("✅ Scrape router is working properly with deduplication");
});

module.exports = router;
