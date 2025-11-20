// server/scrapers/linkedinScraper.js
import * as cheerio from "cheerio";


/**
 * linkedinScraper(roles, city, lastRun)
 * - lastRun: Date object or timestamp. Only jobs with posted_date > lastRun will be returned.
 *
 * Note: This is a basic HTML-scrape approach. LinkedIn blocks heavy scraping. Keep rate-limits and consider authenticated APIs later.
 */
export async function linkedinScraper(roles, city, lastRun) {
  console.log(`🟦 LinkedIn scraper running. lastRun = ${lastRun}`);

  const allJobs = [];

  // iterate each role (single page fetch per role)
  for (const role of roles) {
    try {
      const query = `${role} ${city}`;
      const url = `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(query)}`;
      console.log("🔗 LinkedIn Fetching:", url);

      // fetch HTML (ensure global fetch exists; Node 18+ has fetch)
      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn(`⚠️ LinkedIn fetch failed for ${url}: ${resp.status}`);
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

          const postedText = $(el).find("time").attr("datetime"); // ISO
          const postedDate = postedText ? new Date(postedText) : null;

          // If lastRun provided, skip older/equal posts
          if (lastRun && postedDate) {
            const last = new Date(lastRun);
            if (postedDate <= last) {
              return; // skip
            }
          }

          allJobs.push({
            title: title || "",
            company: company || "",
            location: location || "",
            url: link || "",
            source: "linkedin",
            posted_date: postedDate ? postedDate.toISOString() : null,
            days_ago: null
          });
        } catch (err) {
          // skip problematic element
          console.warn("⚠️ LinkedIn element parse error:", err && err.message ? err.message : err);
        }
      });
    } catch (err) {
      console.error("❌ LinkedIn scrape error:", err && err.message ? err.message : err);
    }
  }

  console.log(`✅ LinkedIn scraper found ${allJobs.length} jobs after filtering.`);
  return allJobs;
}
