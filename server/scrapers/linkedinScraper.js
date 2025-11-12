// server/scrapers/linkedinScraper.js
const puppeteer = require('puppeteer');
const fs = require('fs');

/**
 * linkedinScraper(roles: string[], city: string)
 * returns array of jobs: { title, company, location, url, source, posted_date, days_ago }
 */
module.exports = async function linkedinScraper(roles = [], city = '') {
  console.log('🔍 Starting LinkedIn scraper for', roles.join(', '), city);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const results = [];

  // Helper to parse relative text like "2 days ago", "Posted 3 days ago", "1 week ago", "30+ days ago", "Just posted"
  function parseRelativeDate(text) {
    if (!text) return null;
    text = text.toLowerCase().trim();

    const now = new Date();

    if (text.includes('just') || text.includes('today')) return now;

    // examples: "2 days ago", "Posted 3 days ago", "1 week ago"
    const daysMatch = text.match(/(\d+)\s+day/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return d;
    }
    const weeksMatch = text.match(/(\d+)\s+week/);
    if (weeksMatch) {
      const weeks = parseInt(weeksMatch[1], 10);
      const d = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
      return d;
    }
    const hoursMatch = text.match(/(\d+)\s+hour/);
    if (hoursMatch) {
      const hours = parseInt(hoursMatch[1], 10);
      const d = new Date(now.getTime() - hours * 60 * 60 * 1000);
      return d;
    }
    const minsMatch = text.match(/(\d+)\s+min/);
    if (minsMatch) {
      const mins = parseInt(minsMatch[1], 10);
      const d = new Date(now.getTime() - mins * 60 * 1000);
      return d;
    }

    // If it's a full date/ISO we try Date.parse
    const parsed = Date.parse(text);
    if (!isNaN(parsed)) return new Date(parsed);

    return null;
  }

  try {
    const query = encodeURIComponent(`${roles.join(' OR ')} ${city}`.trim());
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${query}&location=${encodeURIComponent(city)}`;

    console.log('🌐 Visiting:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for cards
    await page.waitForSelector('.base-card, .job-card-container', { timeout: 20000 });

    // Extract up to 50 cards (you can change limit)
    const jobs = await page.$$eval('.base-card, .job-card-container', (els) =>
      els.slice(0, 50).map(el => {
        // Try multiple selectors for title/company/location/url/time
        const title =
          el.querySelector('.base-search-card__title')?.innerText ||
          el.querySelector('.job-card-list__title')?.innerText ||
          el.querySelector('.job-card-container__title')?.innerText ||
          '';

        const company =
          el.querySelector('.base-search-card__subtitle')?.innerText ||
          el.querySelector('.job-card-container__company-name')?.innerText ||
          el.querySelector('.job-card-container__company')?.innerText ||
          '';

        const location =
          el.querySelector('.job-search-card__location')?.innerText ||
          el.querySelector('.job-card-container__metadata-item')?.innerText ||
          el.querySelector('.base-search-card__location')?.innerText ||
          '';

        const url =
          el.querySelector('a.base-card__full-link')?.href ||
          el.querySelector('a.job-card-container__link')?.href ||
          '';

        // posted text
        const postedText =
          el.querySelector('time')?.innerText ||
          el.querySelector('.job-card-list__footer-wrapper time')?.innerText ||
          el.querySelector('.job-card-list__footer-wrapper .date')?.innerText ||
          '';

        return {
          title: title?.trim(),
          company: company?.trim(),
          location: location?.trim(),
          url: url || '',
          source: 'linkedin',
          postedText: postedText?.trim()
        };
      })
    );

    // Convert postedText to posted_date and days_ago in Node (so we can use parseRelativeDate())
    for (const j of jobs) {
      let posted_date = new Date().toISOString();
      let days_ago = 0;
      try {
        const candidate = parseRelativeDate(j.postedText);
        if (candidate) {
          posted_date = candidate.toISOString();
          const diffMs = Date.now() - candidate.getTime();
          days_ago = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }
      } catch (e) {
        // fallback
        posted_date = new Date().toISOString();
      }

      results.push({
        title: j.title || '',
        company: j.company || '',
        location: j.location || city || '',
        url: j.url || '',
        source: 'linkedin',
        posted_date,
        days_ago
      });
    }
  } catch (e) {
    console.error('❌ LinkedIn scrape failed:', e.message);
    try {
      const html = await page.content();
      fs.writeFileSync('linkedin_debug.html', html);
      console.log('🧾 Saved snapshot: linkedin_debug.html');
    } catch (writeErr) {
      console.error('⚠️ Failed to save snapshot:', writeErr.message);
    }
  } finally {
    await browser.close();
  }

  console.log(`✅ LinkedIn scraper found ${results.length} jobs`);
  return results;
};
