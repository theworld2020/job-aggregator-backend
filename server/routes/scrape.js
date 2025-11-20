// server/routes/scrape.js
import express from "express";
import pkg from "pg";
import scrapeFromSites from "../scrapers/index.js";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

router.get("/test", (req, res) => {
  res.send("✅ Scrape router is working");
});

// Main scrape route
router.post("/", async (req, res) => {
  let { roles, city, sites } = req.body || {};

  roles = Array.isArray(roles) && roles.length > 0
    ? roles
    : [
        "Product Manager",
        "Product Owner",
        "Senior Product Owner",
        "Senior Product Manager"
      ];

  city = city || "Bangalore";

  // LinkedIn removed
  sites = Array.isArray(sites) && sites.length > 0
    ? sites
    : ["instahyre", "naukri"];

  console.log(`
==============================
🕓 Scrape Triggered
Roles: ${roles.join(", ")}
City: ${city}
Sites: ${sites.join(", ")}
Time: ${new Date().toISOString()}
==============================
  `);

  let totalInserted = 0;

  try {
    for (const site of sites) {
      console.log(`\n--- Site: ${site} ---`);

      const statusRes = await pool.query(
        "SELECT last_scraped_at FROM scrape_status WHERE site=$1 LIMIT 1",
        [site]
      );

      let lastScrapedAt;

      if (statusRes.rowCount === 0) {
        lastScrapedAt = new Date(Date.now() - 12 * 60 * 60 * 1000);
        console.log(`🟢 First run for ${site}, scraping last 12 hours starting at ${lastScrapedAt.toISOString()}`);

        await pool.query(
          "INSERT INTO scrape_status (site, last_scraped_at) VALUES ($1, NOW())",
          [site]
        );
      } else {
        lastScrapedAt = statusRes.rows[0].last_scraped_at;
        console.log(`⏳ Last scraped for ${site}: ${lastScrapedAt.toISOString()}`);
      }

      const siteResults = await scrapeFromSites([site], roles, city, lastScrapedAt);

      console.log(`📥 ${site} returned ${siteResults.length} new jobs.`);

      for (const job of siteResults) {
        try {
          await pool.query(
            `INSERT INTO jobs (title, company, location, url, source, posted_date, days_ago)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [job.title, job.company, job.location, job.url, job.source, job.posted_date, job.days_ago]
          );
          totalInserted++;
        } catch (e) {
          console.error(`❌ Insert error for ${site}:`, e.message);
        }
      }

      await pool.query(
        "UPDATE scrape_status SET last_scraped_at = NOW() WHERE site=$1",
        [site]
      );
      console.log(`✅ Updated last_scraped_at for ${site}`);
    }

    console.log(`\n✅ Scrape completed — total inserted = ${totalInserted}`);
    return res.json({ inserted: totalInserted });

  } catch (err) {
    console.error("❌ Scrape route failed:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

export default router;
