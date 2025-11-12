// server/scrapers/linkedinScraper.js
const fs = require('fs');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

/**
 * linkedinScraper(roles: string[], city: string)
 * returns array of jobs: { title, company, location, url, source, posted_date, days_ago }
 */
module.exports = async function linkedinScraper(roles = [], city = '') {
  console.log('🔍 Starting LinkedIn scraper for', roles.join(', '), city);

  const executablePath = await chromium.executablePath;

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true
  });

  const page = await browser.newPage();
  const results = [];

  // ✅ Helper to convert "2 days ago" → Date()
  function parseRelativeDate(text) {
    if (!text) return new Date();
    text = text.toLowerCase().trim();
    const now = new Date();

    if (text.includes('today') || text.includes('just')) return now;
    if (text.includes('yesterday')) {
      const d = new Date(now);
      d.setDate(now.getDate() - 1);
      return d;
    }

    const dayMatch = text.match(/(\d+)\s+day/);
    if (dayMatch) {
      const d = new Date(now);
      d.setDate(now.getDate() - parseInt(dayMatch[1], 10));
      return d;
    }

    const weekMatch = text.match(/(\d+)\s+week/);
    if (weekMatch) {
      const d = new Date(now);
      d.setDate(now.getDate() - parseInt(weekMatch[1], 10) * 7);
      return d;
    }

    const hourMatch = text.match(/(\d+)\s+hour/);
    if (hourMatch) {
      const d = new Date(now);
      d.setHours(now.getHours() - parseInt(hourMatch[1], 10));
      return d;
    }

    // fallback
    return now;
  }

  try {
    const query = encodeURIComponent(`${roles.join(' OR ')} ${city}`.trim());
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${query}&location=${encodeURIComponent(city)}&f_TPR=r604800`;
    console.log('🌐 Visiting:', url);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    await page.waitForSelector('.base-card, .job-card-container', { timeout: 20000 });

    // ✅ Scrape multiple selectors
    const jobs = await page.$$eval('.base-card, .job-card-container', (els) =>
      els.slice(0, 50).map(el => {
        const title =
          el.querySelector('.base-search-card__title')?.innerText?.trim() ||
          el.querySelector('.job-card-container__title')?.innerText?.trim() || '';

        const company =
          el.querySelector('.base-search-card__subtitle')?.innerText?.trim() ||
          el.querySelector('.job-card-container__company-name')?.innerText?.trim() || '';

        const location =
          el.querySelector('.job-search-card__location')?.innerText?.trim() ||
          el.querySelector('.job-card-container__metadata-item')?.innerText?.trim() || '';

        const url =
          el.querySelector('a.base-card__full-link')?.href ||
          el.querySelector('a.job-card-container__link')?.href || '';

        const postedText =
          el.querySelector('time')?.innerText?.trim() ||
          el.querySelector('.job-card-list__footer-wrapper time')?.innerText?.trim() || '';

        return { title, company, location, url, postedText };
      })
    );

    // ✅ Normalize and parse dates
    for (const j of jobs) {
      const parsedDate = parseRelativeDate(j.postedText);
      const days_ago = Math.floor((Date.now() - parsedDate.getTime()) / (1000 * 60 * 60 * 24));

      results.push({
        title: j.title || '',
        company: j.company || '',
        location: j.location || city,
        url: j.url || '',
        source: 'linkedin',
        posted_date: parsedDate.toISOString(),
        days_ago
      });
    }
  } catch (e) {
    console.error('❌ LinkedIn scrape failed:', e.message);
    try {
      const html = await page.content();
      fs.writeFileSync('linkedin_debug.html', html);
      console.log('🧾 Saved snapshot: linkedin_debug.html');
    } catch (err) {
      console.error('⚠️ Could not save debug snapshot:', err.message);
    }
  } finally {
    await browser.close();
  }

  console.log(`✅ LinkedIn scraper found ${results.length} jobs`);
  return results;
};
