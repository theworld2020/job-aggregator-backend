// server/scrapers/linkedinScraper.js
import * as cheerio from "cheerio";

/**
 * Normalize cities to LinkedIn-supported format.
 * This ensures correct location filtering (ex: Bangalore → Bengaluru).
 */
function normalizeCity(city) {
  const map = {
    "bangalore": "Bengaluru, Karnataka, India",
    "bengaluru": "Bengaluru, Karnataka, India",
    "mumbai": "Mumbai, Maharashtra, India",
    "delhi": "New Delhi, Delhi, India",
    "chennai": "Chennai, Tamil Nadu, India",
    "hyderabad": "Hyderabad, Telangana, India",
    "pune": "Pune, Maharashtra, India",
  };

  const key = city.trim().toLowerCase();
  return map[key] || `${city}, India`; // fallback
}

/**
 * LinkedIn scraper
 */
export async function linkedinScraper(roles, city, lastRun) {
  console.log(`🟦 LinkedIn scraper running. lastRun = ${lastRun}`);

  const allJobs = [];
  const normalizedLocation = normalizeCity(city);

  for (const role of roles) {
    try {
      const roleQuery = encodeURIComponent(role);
      const locQuery = encodeURIComponent(normalizedLocation);

      // Correct LinkedIn job search URL
      const url = `https://www.linkedin.com/jobs/search/?keywords=${roleQuery}&location=${locQuery}`;

      console.log("🔗 LinkedIn Fetching:", url);

      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn(`⚠️ LinkedIn fetch failed: HTTP ${resp.status}`);
        continue;
      }

      const html = await resp.text();
      const $ = cheerio.load(html);

      $(".base-card").each((_, el) => {
        try {
          const title = $(el).find(".base-search-card__title").text().trim();
          const company = $(el).find(".base-search-card__subtitle").text().trim();
          const location = $(el).find(".job-search-card__location").text().trim();
          const link = $(el).find("a.base-card__full-link").attr("href");

          const postedText = $(el).find("time").attr("datetime");
          const postedDate = postedText ? new Date(postedText) : null;

          // ⏳ Incremental filtering (skip older jobs)
          if (lastRun && postedDate) {
            const last = new Date(lastRun);
            if (postedDate <= last) return;
          }

          allJobs.push({
            title: title || "",
            company: company || "",
            location: location || "",
            url: link || "",
            source: "linkedin",
            posted_date: postedDate ? postedDate.toISOString() : null,
            days_ago: null,
          });

        } catch (err) {
          console.warn("⚠️ LinkedIn element parse error:", err.message);
        }
      });

    } catch (err) {
      console.error("❌ LinkedIn scrape error:", err.message);
    }
  }

  console.log(`✅ LinkedIn scraper found ${allJobs.length} new jobs.`);
  return allJobs;
}
