import linkedinScraper from "./linkedinScraper.js";
import naukriScraper from "./naukriScraper.js";
import instahyreScraper from "./instahyreScraper.js";

export async function runScraper(sites, roles, city) {
  console.log(`🚀 Running scrapers for: ${roles.join(", ")} in ${city}`);

  let allResults = [];

  if (sites.includes("linkedin")) {
    const linkedinResults = await linkedinScraper(roles, city);
    allResults = allResults.concat(linkedinResults);
  }

  if (sites.includes("naukri")) {
    const naukriResults = await naukriScraper(roles, city);
    allResults = allResults.concat(naukriResults);
  }

  if (sites.includes("instahyre")) {
    const instahyreResults = await instahyreScraper(roles, city);
    allResults = allResults.concat(instahyreResults);
  }

  console.log(`📦 Total jobs scraped: ${allResults.length}`);
  return allResults;
}
