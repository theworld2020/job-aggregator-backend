import express from "express";
import { runScraper } from "../scrapers/index.js";
import pool from "../db/db.js";

const router = express.Router();
const SCRAPE_SECRET = process.env.SCRAPE_SECRET || "S3cureScrape!2025";

/**
 * POST /api/scrape
 * Body: { roles: [string], city: string, sites: [string] }
 */
router.post("/", async (req, res) => {
  const { roles, city, sites } = req.body;
  const headerSecret = req.headers["x-scrape-secret"];

  if (headerSecret !== SCRAPE_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!roles || !Array.isArray(roles) || !city) {
    return res.status(400).json({ error: "Invalid parameters" });
  }

  console.log("🚀 Triggered scrape for:", roles.join(", "), "in", city);

  try {
    const jobs = await runScraper(roles, city);
    console.log(`🔍 Total scraped: ${jobs.length}`);

    let insertedCount = 0;

    for (const job of jobs) {
      const { title, company, location, source, url, posted_date } = job;

      // Skip if missing critical data
      if (!title || !company || !url) continue;

      // Deduplication check (company + title + posted_date)
      const existing = await pool.query(
        `SELECT id FROM jobs WHERE company = $1 AND title = $2 AND (posted_date IS NULL OR posted_date = $3) LIMIT 1`,
        [company, title, posted_date]
      );

      if (existing.rows.length === 0) {
        await pool.query(
          `INSERT INTO jobs (title, company, location, source, url, posted_date, scraped_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [title, company, location, source, url, posted_date]
        );
        insertedCount++;
      }
    }

    console.log(`✅ Inserted ${insertedCount} new jobs into DB.`);
    res.json({ inserted: insertedCount, totalScraped: jobs.length });
  } catch (error) {
    console.error("❌ Scraper error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
