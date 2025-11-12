const linkedinScraper = require('./linkedinScraper');

module.exports = async function scrapeFromSites(sites, roles, city) {
  const results = [];

  for (const site of sites) {
    if (site === 'linkedin') {
      const siteResults = await linkedinScraper(roles, city);
      results.push(...siteResults);
    }
    // Future: add more sites (e.g., instahyre, naukri, indeed)
  }

  return results;
};
