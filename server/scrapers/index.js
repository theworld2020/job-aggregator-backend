// server/scrapers/index.js
import { linkedinScraper } from "./linkedinScraper.js"; // kept for future
import { naukriScraper } from "./naukriScraper.js";
import { instahyreScraper } from "./instahyreScraper.js";

/**
 * scrapeFromSites(sites, roles, city, lastScrapedAt)
 * Handles each site's scraper — but LinkedIn is disabled.
 */
export default async function scrapeFromSites(sites, roles, city, lastScrapedAt) {
  let results = [];

  for (const site of sites) {
    try {
      if (site === "linkedin") {
        console.log("⚠️ LinkedIn scraper disabled — skipping.");
        continue; // DO NOT RUN LINKEDIN
      }

      if (site === "naukri") {
        const res = await naukriScraper(roles, city, lastScrapedAt);
        if (Array.isArray(res)) results.push(...res);
      } 
      else if (site === "instahyre") {
        const res = await instahyreScraper(roles, city, lastScrapedAt);
        if (Array.isArray(res)) results.push(...res);
      } 
      else {
        console.warn(`⚠️ Unknown site: ${site}`);
      }

    } catch (err) {
      console.error(`❌ Scraper error (${site}):`, err?.message || err);
    }
  }

  return results;
}
