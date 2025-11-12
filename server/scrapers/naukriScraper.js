const puppeteer = require('puppeteer');

module.exports = async function naukriScraper(roles, city) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  try {
    const query = encodeURIComponent(`${roles.join(' ')} ${city}`);
    await page.goto(`https://www.naukri.com/${query}-jobs`, { waitUntil: 'domcontentloaded' });

    const jobs = await page.$$eval('.jobTuple', els =>
      els.slice(0, 10).map(el => ({
        title: el.querySelector('.title')?.innerText || '',
        company: el.querySelector('.subTitle')?.innerText || '',
        location: el.querySelector('.loc')?.innerText || '',
        url: el.querySelector('.title a')?.href || '',
        source: 'naukri',
        posted_date: new Date().toISOString(),
        days_ago: 0
      }))
    );

    results.push(...jobs);
  } catch (e) {
    console.error('Naukri scrape failed:', e.message);
  } finally {
    await browser.close();
  }

  return results;
};
