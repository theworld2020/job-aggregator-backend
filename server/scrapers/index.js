import { linkedinScraper } from "./linkedinScraper.js";
import { naukriScraper } from "./naukriScraper.js";
import { instahyreScraper } from "./instahyreScraper.js";

export async function runScraper(sites, roles, city, lastRun) {
  let results = [];

  console.log("⏳ Scraping with lastRun =", lastRun);

  if (sites.includes("linkedin")) {
    const linkedinData = await linkedinScraper(roles, city, lastRun);
    results = results.concat(linkedinData);
  }

  return results;
}
