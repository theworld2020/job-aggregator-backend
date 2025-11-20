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

// Test route
router.get("/test", (req, res) => {
  res.send("✅ Scrape router is working");
});

// Main scrape route (Cronhooks + manual)
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

  sites = Array.isArray(sites) && sites.length > 0
    ? sites
    : ["linkedin", "instahyre", "naukri"];

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
        console.error("❌ Insert error:", e.message);
      }
    }

    console.log(`✅ Inserted ${totalInserted} new jobs`);
    return res.json({ inserted: totalInserted });

  } catch (err) {
    console.error("❌ Scrape route failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
