// scrapers/index.js (FINAL ESM VERSION)

import { linkedinScraper } from "./linkedinScraper.js";
import { naukriScraper } from "./naukriScraper.js";
import { instahyreScraper } from "./instahyreScraper.js";

export default async function scrapeFromSites(sites, roles, city) {
  let results = [];

  const jobsBySite = await Promise.all(
    sites.map(async (site) => {
      try {
        if (site === "linkedin") {
          return await linkedinScraper(roles, city);
        }
        if (site === "naukri") {
          return await naukriScraper(roles, city);
        }
        if (site === "instahyre") {
          return await instahyreScraper(roles, city);
        }

        return [];
      } catch (err) {
        console.error(`❌ Scraper error for ${site}:`, err.message);
        return [];
      }
    })
  );

  // Flatten results
  for (const arr of jobsBySite) {
    if (Array.isArray(arr)) {
      results = results.concat(arr);
    }
  }

  return results;
}
