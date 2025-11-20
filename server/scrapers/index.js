/*
  scrapeFromSites(sites, roles, city)
  - sites: array of site keys ['linkedin','naukri',...]
  - roles: array of role strings
  - city: location string

  This file should import and call individual scrapers and return a flat array
  of job objects: [{title, company, location, url, source, posted_date, days_ago}, ...]
*/

const linkedin = require('./linkedinScraper');
const naukri = require('./naukriScraper');
const instahyre = require('./instahyreScraper');

module.exports = async function scrapeFromSites(sites, roles, city) {
  let results = [];

  const jobsBySite = await Promise.all(sites.map(async (site) => {
    try {
      if (site === 'linkedin' && typeof linkedin === 'function') {
        return await linkedin(roles, city);
      } else if (site === 'naukri' && typeof naukri === 'function') {
        return await naukri(roles, city);
      } else if (site === 'instahyre' && typeof instahyre === 'function') {
        return await instahyre(roles, city);
      } else {
        return [];
      }
    } catch (err) {
      console.error('Scraper error for', site, err.message);
      return [];
    }
  }));

  for (const arr of jobsBySite) {
    if (Array.isArray(arr)) results = results.concat(arr);
  }

  return results;
};
