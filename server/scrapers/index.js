// server/scrapers/index.js
import { linkedinScraper } from "./linkedinScraper.js";
import { naukriScraper } from "./naukriScraper.js";
import { instahyreScraper } from "./instahyreScraper.js";

/**
 * scrapeFromSites(sites, roles, city, lastScrapedAt)
 * - sites: array of site strings (e.g. ['linkedin'])
 * - roles: array of role strings
 * - city: location string
 * - lastScrapedAt: Date object OR timestamp for filtering (passed per-site from caller)
 *
 * This function will call each site's scraper and return a flat array of job objects.
 */
export default async function scrapeFromSites(sites, roles, city, lastScrapedAt) {
  let results = [];

  // The caller (routes/scrape.js) will call this per-site, passing that site's lastScrapedAt.
  for (const site of sites) {
    try {
      if (site === "linkedin") {
        const res = await linkedinScraper(roles, city, lastScrapedAt);
        if (Array.isArray(res)) results.push(...res);
      } else if (site === "naukri") {
        const res = await naukriScraper(roles, city, lastScrapedAt);
        if (Array.isArray(res)) results.push(...res);
      } else if (site === "instahyre") {
        const res = await instahyreScraper(roles, city, lastScrapedAt);
        if (Array.isArray(res)) results.push(...res);
      } else {
        console.warn(`⚠️ Unknown site key: ${site}`);
      }
    } catch (err) {
      console.error(`❌ Scraper error for ${site}:`, err && err.message ? err.message : err);
    }
  }

  return results;
}
