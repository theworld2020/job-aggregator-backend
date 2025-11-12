// server/scrapers/index.js
const linkedinScraper = require('./linkedinScraper');
// future: const naukriScraper = require('./naukriScraper');

module.exports = async function scrapeFromSites(sites = [], roles = [], city = '') {
  const results = [];

  for (const site of sites) {
    if (site === 'linkedin') {
      const siteResults = await linkedinScraper(roles, city);
      results.push(...siteResults);
    }
    // else if (site === 'naukri') { ... }
  }

  return results;
};
