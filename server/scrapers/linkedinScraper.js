const puppeteer = require('puppeteer');
const fs = require('fs');

module.exports = async function linkedinScraper(roles, city) {
  console.log('🔍 Starting LinkedIn scraper for', roles.join(','), city);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const results = [];

  try {
    // 🔹 Use LinkedIn Guest Jobs API (no login required)
    const query = encodeURIComponent(`${roles.join(' OR ')} ${city}`);
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${query}&location=${encodeURIComponent(city)}&f_TPR=r604800`;

    console.log('🌐 Visiting:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // 🔹 Wait for LinkedIn job cards to load
    await page.waitForSelector('.base-card, .job-card-container', { timeout: 30000 });

    // 🔹 Scrape job details from visible cards
    const jobs = await page.$$eval('.base-card, .job-card-container', els =>
      els.slice(0, 10).map(el => ({
        title: el.querySelector('.base-search-card__title, .job-card-list__title')?.innerText.trim() || '',
        company: el.querySelector('.base-search-card__subtitle, .job-card-container__company-name')?.innerText.trim() || '',
        location: el.querySelector('.job-search-card__location, .job-card-container__metadata-item')?.innerText.trim() || '',
        url: el.querySelector('a.base-card__full-link, a.job-card-container__link')?.href || '',
        source: 'linkedin',
        posted_date: new Date().toISOString(),
        days_ago: 0
      }))
    );

    results.push(...jobs);
  } catch (e) {
    console.error('❌ LinkedIn scrape failed:', e.message);
    // 🔹 Save page content for debugging
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
