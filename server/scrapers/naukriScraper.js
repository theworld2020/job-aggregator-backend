import puppeteer from "puppeteer";

/**
 * Scrapes Naukri job listings for the given roles and city.
 */
export default async function naukriScraper(roles, city) {
  console.log("🟧 Running Naukri scraper for:", roles.join(", "), "in", city);
  const allJobs = [];
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    for (const role of roles) {
      const query = encodeURIComponent(`${role} ${city}`);
      const url = `https://www.naukri.com/${query}-jobs`;

      console.log("🔗 Fetching:", url);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

      const jobs = await page.$$eval(".jobTuple", (cards) =>
        cards.map((card) => {
          const title = card.querySelector(".title")?.innerText.trim();
          const company = card.querySelector(".subTitle")?.innerText.trim();
          const location = card.querySelector(".loc")?.innerText.trim();
          const url = card.querySelector("a.title")?.href;
          return title && company && url
            ? { title, company, location, source: "Naukri", url }
            : null;
        })
      );

      allJobs.push(...jobs.filter(Boolean));
    }

    console.log(`✅ Naukri scraper found ${allJobs.length} jobs.`);
  } catch (err) {
    console.error("❌ Naukri scraper failed:", err.message);
  } finally {
    await browser.close();
  }

  return allJobs;
}
