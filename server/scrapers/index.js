import linkedinScraper from "./linkedinScraper.js";
import naukriScraper from "./naukriScraper.js";
import instahyreScraper from "./instahyreScraper.js";

/**
 * Runs all active scrapers and combines results.
 */
export async function runScraper(roles, city) {
  console.log("🚀 Running scrapers for:", roles.join(", "), "in", city);

  const results = [];

  try {
    const [linkedinJobs, naukriJobs, instahyreJobs] = await Promise.all([
      linkedinScraper(roles, city),
      naukriScraper(roles, city),
      instahyreScraper(roles, city),
    ]);

    results.push(...linkedinJobs, ...naukriJobs, ...instahyreJobs);
  } catch (error) {
    console.error("❌ Error in runScraper:", error.message);
  }

  console.log(`📦 Total jobs scraped: ${results.length}`);
  return results;
}
