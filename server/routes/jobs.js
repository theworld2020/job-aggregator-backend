import express from "express";
import pool from "../db/db.js";
const router = express.Router();

/**
 * 🟢 IMPORTANT:
 * Secret check ONLY for /upload route.
 * No middleware above this.
 */

router.post("/upload", async (req, res) => {
  try {
    const secret = req.headers["x-scrape-secret"];

    // Secret only for /upload
    if (secret !== process.env.SCRAPE_SECRET) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { jobs } = req.body;
    if (!jobs || !Array.isArray(jobs) || jobs.length === 0)
      return res.status(400).json({ error: "No jobs provided" });

    let inserted = 0;

    for (const job of jobs) {
      const existing = await pool.query(
        `SELECT 1 FROM jobs WHERE title=$1 AND company=$2 AND posted_date=$3`,
        [job.title, job.company, job.posted_date]
      );

      if (existing.rowCount === 0) {
        await pool.query(
          `INSERT INTO jobs (title, company, location, source, url, posted_date, days_ago)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            job.title,
            job.company,
            job.location,
            job.source,
            job.url,
            job.posted_date,
            job.days_ago,
          ]
        );
        inserted++;
      }
    }

    res.json({ inserted, total: jobs.length });
  } catch (err) {
    console.error("❌ Upload route error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
