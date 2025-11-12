const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const fs = require("fs");

module.exports = async function linkedinScraper(roles, city) {
  console.log("🔍 Starting LinkedIn scraper for", roles.join(", "), city);

  let browser;
  const results = [];

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    const query = encodeURIComponent(`${roles.join(" OR ")} ${city}`);
    const url = `https://www.linkedin.com/jobs/search?keywords=${query}&location=${encodeURIComponent(city)}&f_TPR=r604800`;
    console.log("🌐 Visiting:", url);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // Try to close login or cookie popups
    try {
      await page.evaluate(() => {
        const dismissBtns = Array.from(document.querySelectorAll("button"));
        const dismiss = dismissBtns.find(b => 
          b.innerText.includes("Sign in") || 
          b.innerText.includes("Accept") || 
          b.getAttribute("aria-label")?.includes("Dismiss"));
        if (dismiss) dismiss.click();
      });
    } catch {
      console.log("ℹ️ No popup to close");
    }

    // Wait for job cards (LinkedIn changes these often)
    await page.waitForSelector(".job-search-card", { timeout: 20000 }).catch(() => console.warn("⚠️ No job cards found yet"));

    await autoScroll(page);

    const jobs = await page.$$eval(".job-search-card", els =>
      els.slice(0, 25).map(el => ({
        title: el.querySelector(".base-search-card__title")?.innerText.trim() || "",
        company: el.querySelector(".base-search-card__subtitle")?.innerText.trim() || "",
        location: el.querySelector(".job-search-card__location")?.innerText.trim() || "",
        url: el.querySelector("a.base-card__full-link")?.href || "",
        source: "linkedin",
        posted_date: new Date().toISOString(),
        days_ago: 0,
      }))
    );

    results.push(...jobs);
  } catch (e) {
    console.error("❌ LinkedIn scrape failed:", e.message);
    try {
      const html = await (await page.content());
      fs.writeFileSync("linkedin_debug.html", html);
      console.log("🧾 Saved snapshot: linkedin_debug.html");
    } catch {}
  } finally {
    if (browser) await browser.close();
  }

  console.log(`✅ LinkedIn scraper found ${results.length} jobs`);
  return results;
};

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 250);
    });
  });
}
