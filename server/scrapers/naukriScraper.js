import puppeteer from "puppeteer";

export default async function naukriScraper(roles, city) {
  console.log(`🟧 Running Naukri scraper for: ${roles.join(", ")} in ${city}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  const results = [];

  for (const role of roles) {
    const searchUrl = `https://www.naukri.com/${encodeURIComponent(role)}-${encodeURIComponent(city)}-jobs`;
    console.log(`🔗 Fetching: ${searchUrl}`);

    try {
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      const jobs = await page.$$eval(".jobTuple", (nodes) =>
        nodes.map((node) => {
          const title = node.querySelector(".title")?.innerText.trim() || "";
          const company = node.querySelector(".subTitle")?.innerText.trim() || "";
          const location = node.querySelector(".loc")?.innerText.trim() || "";
          const link = node.querySelector(".title a")?.href || "";
          return { title, company, location, source: "Naukri", url: link };
        })
      );
      results.push(...jobs);
    } catch (err) {
      console.error(`⚠️ Error scraping Naukri for role ${role}:`, err.message);
    }
  }

  await browser.close();
  console.log(`✅ Naukri scraper found ${results.length} jobs.`);
  return results;
}
