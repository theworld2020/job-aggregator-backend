// server/scrapers/linkedinScraper.js
import * as cheerio from "cheerio";

/**
 * Normalize cities to LinkedIn-supported format.
 */
function normalizeCity(city) {
  const map = {
    bangalore: "Bengaluru, Karnataka, India",
    bengaluru: "Bengaluru, Karnataka, India",
    mumbai: "Mumbai, Maharashtra, India",
    delhi: "New Delhi, Delhi, India",
    chennai: "Chennai, Tamil Nadu, India",
    hyderabad: "Hyderabad, Telangana, India",
    pune: "Pune, Maharashtra, India",
  };
  const key = city.trim().toLowerCase();
  return map[key] || `${city}, India`;
}

/**
 * Extract JSON from <script type="application/ld+json"> blocks
 */
function extractJSONData(html) {
  const $ = cheerio.load(html);
  let jobs = [];

  $("script[type='application/ld+json']").each((_, el) => {
    try {
      const jsonText = $(el).html();
      if (!jsonText) return;

      const data = JSON.parse(jsonText);

      // If it's a job posting
      if (Array.isArray(data)) {
        data.forEach((obj) => {
          if (obj["@type"] === "JobPosting") {
            jobs.push(obj);
          }
        });
      } else if (data["@type"] === "JobPosting") {
        jobs.push(data);
      }
    } catch (err) {
      // Ignore broken JSON blocks
    }
  });

  return jobs;
}

/**
 * Final LinkedIn Scraper (JSON based)
 */
export async function linkedinScraper(roles, city, lastRun) {
  console.log(`🟦 LinkedIn scraper (JSON) running. lastRun = ${lastRun}`);

  const normalizedLocation = normalizeCity(city);
  const allJobs = [];

  for (const role of roles) {
    try {
      const roleQuery = encodeURIComponent(role);
      const locQuery = encodeURIComponent(normalizedLocation);

      const url = `https://www.linkedin.com/jobs/search/?keywords=${roleQuery}&location=${locQuery}`;
      console.log("🔗 Fetching LinkedIn:", url);

      const resp = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
        },
      });

      if (!resp.ok) {
        console.warn(`⚠️ LinkedIn fetch failed ${resp.status}`);
        continue;
      }

      const html = await resp.text();

      // Extract JSON
      const jsonJobs = extractJSONData(html);

      console.log(`📥 Extracted ${jsonJobs.length} JSON jobs from LinkedIn`);

      for (const job of jsonJobs) {
        try {
          const title = job.title || "";
          const company = job.hiringOrganization?.name || "";
          const location =
            job.jobLocation?.address?.addressLocality ||
            job.jobLocation?.address?.addressRegion ||
            job.jobLocation?.address?.addressCountry ||
            "";
          const url = job.url || "";
          const postedDate = job.datePosted ? new Date(job.datePosted) : null;

          // Incremental filtering
          if (postedDate && lastRun && postedDate <= new Date(lastRun)) {
            continue;
          }

          allJobs.push({
            title,
            company,
            location,
            url,
            source: "linkedin",
            posted_date: postedDate ? postedDate.toISOString() : null,
            days_ago: null,
          });
        } catch (err) {
          console.warn("⚠️ JSON job parse error:", err.message);
        }
      }
    } catch (err) {
      console.error("❌ LinkedIn JSON scrape error:", err.message);
    }
  }

  console.log(`✅ LinkedIn JSON scraper found ${allJobs.length} jobs.`);
  return allJobs;
}
