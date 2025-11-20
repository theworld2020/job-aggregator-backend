// server/scrapers/linkedinScraper.js
import * as cheerio from "cheerio";
import fs from "fs";

/**
 * Browserless-backed LinkedIn scraper (production-ready)
 *
 * Supports:
 *  - Browserless rendering
 *  - Pagination
 *  - Retry / backoff
 *  - Multi-location fallback
 *  - Incremental filtering
 *  - Debug mode: read HTML from local file
 *  - HTML saving: write rendered pages into /tmp for debugging
 */

/* ========== Config ========== */
const PAGE_SIZE = 25;
const MAX_PAGES = 8;
const MAX_CONSECUTIVE_EMPTY = 3;
const RETRIES = 5;
const RETRY_BASE_DELAY_MS = 800;
const PAGE_DELAY_MS = 1200;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
];

/* ========== Helpers ========== */
function normalizeCity(city) {
  if (!city || typeof city !== "string")
    return "Bengaluru, Karnataka, India";

  const map = {
    bangalore: "Bengaluru, Karnataka, India",
    bengaluru: "Bengaluru, Karnataka, India",
    mumbai: "Mumbai, Maharashtra, India",
    delhi: "New Delhi, Delhi, India",
    chennai: "Chennai, Tamil Nadu, India",
    hyderabad: "Hyderabad, Telangana, India",
    pune: "Pune, Maharashtra, India",
  };
  const key = city.trim().toLowerCase();
  return map[key] || `${city}, India`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pickUserAgent(i = 0) {
  return USER_AGENTS[i % USER_AGENTS.length];
}

async function fetchWithRetries(url, opts = {}) {
  let lastErr = null;
  for (let i = 0; i < RETRIES; i++) {
    try {
      const res = await fetch(url, opts);
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status}`);
      if (res.status === 429 || res.status === 403 || res.status >= 500) {
        const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, i) + randomInt(0, 400);
        await sleep(backoff);
        continue;
      } else {
        return res;
      }
    } catch (err) {
      lastErr = err;
      const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, i) + randomInt(0, 400);
      await sleep(backoff);
      continue;
    }
  }
  throw lastErr || new Error("fetchWithRetries failed");
}

function parseJobCard(el, $) {
  const title =
    $(el).find(".base-search-card__title").text().trim() ||
    $(el).find(".result-card__title").text().trim() ||
    $(el).find("[data-test-job-title]").text().trim() ||
    "";

  const company =
    $(el).find(".base-search-card__subtitle").text().trim() ||
    $(el).find(".result-card__subtitle").text().trim() ||
    $(el).find(".company-name").text().trim() ||
    "";

  const locationText =
    $(el).find(".job-search-card__location").text().trim() ||
    $(el).find(".result-card__location").text().trim() ||
    $(el).find("[data-test-job-location]").text().trim() ||
    "";

  let link =
    $(el).find("a.base-card__full-link").attr("href") ||
    $(el).find("a.result-card__full-card-link").attr("href") ||
    "";

  if (link && link.startsWith("//")) link = "https:" + link;

  const postedText = $(el).find("time").attr("datetime") || $(el).find("time").text().trim() || null;
  const postedAt = postedText ? new Date(postedText) : null;

  return { title, company, location: locationText, url: link, postedAt };
}

/* ========== Browserless Render ========== */
function getBrowserlessBase() {
  return process.env.BROWSERLESS_BASE_URL || "https://chrome.browserless.io/content";
}

async function browserlessRender(url, ua, token, debugName = "") {
  const debugFile = process.env.DEBUG_LINKEDIN_HTML_FILE;

  // Local debugging mode
  if (debugFile && fs.existsSync(debugFile)) {
    return fs.readFileSync(debugFile, "utf-8");
  }

  if (!token) {
    throw new Error("BROWSERLESS_TOKEN missing");
  }

  const full = `${getBrowserlessBase()}?token=${encodeURIComponent(
    token
  )}&url=${encodeURIComponent(url)}`;

  const resp = await fetchWithRetries(full, {
    method: "GET",
    headers: {
      "User-Agent": ua,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  const html = await resp.text();

  /* --- DEBUG SAVE ENABLED? --- */
  if (process.env.SAVE_LINKEDIN_DEBUG_HTML === "true") {
    try {
      const filename = `/tmp/linkedin_debug_${debugName}.html`;
      fs.writeFileSync(filename, html);
      console.log(`💾 Saved LinkedIn debug HTML → ${filename}`);
    } catch (err) {
      console.warn("⚠️ Failed saving debug HTML:", err.message);
    }
  }

  return html;
}

/* ========== MAIN SCRAPER ========== */
export async function linkedinScraper(roles, city, lastRun) {
  console.log(`🟦 LinkedIn (browserless) scraper start — lastRun=${lastRun} city="${city}"`);

  const token = process.env.BROWSERLESS_TOKEN || "";
  const normalizedCity = normalizeCity(city || "Bengaluru");
  const locationFallbacks = [
    normalizedCity,
    normalizedCity.replace("Bengaluru", "Bangalore"),
    "India",
  ];

  const results = [];

  for (const role of roles) {
    let matched = false;

    for (let locIdx = 0; locIdx < locationFallbacks.length && !matched; locIdx++) {
      const loc = locationFallbacks[locIdx];
      const r = encodeURIComponent(role);
      const l = encodeURIComponent(loc);

      let start = 0;
      let empty = 0;

      for (let page = 0; page < MAX_PAGES; page++) {
        await sleep(PAGE_DELAY_MS + randomInt(-300, 300));
        const ua = pickUserAgent(page);

        const browserUrl = `https://www.linkedin.com/jobs/search/?keywords=${r}&location=${l}&start=${start}`;

        let html;

        try {
          html = await browserlessRender(
            browserUrl,
            ua,
            token,
            `${role.replace(/ /g, "_")}_${loc.replace(/ /g, "_")}_start${start}`
          );
        } catch (err) {
          console.error("❌ Browserless error:", err.message);
          empty++;
          if (empty >= MAX_CONSECUTIVE_EMPTY) break;
          continue;
        }

        if (!html || html.length < 200) {
          console.warn(`⚠️ Empty HTML page for ${browserUrl}`);
          empty++;
          if (empty >= MAX_CONSECUTIVE_EMPTY) break;
          start += PAGE_SIZE;
          continue;
        }

        const $ = cheerio.load(html);
        const cards = $(".base-card, li.result-card, .job-card-container, .job-result-card, article");
        let count = 0;

        cards.each((_, el) => {
          const job = parseJobCard(el, $);
          if (!job.title || !job.company) return;

          if (job.postedAt && lastRun && job.postedAt <= new Date(lastRun)) {
            return;
          }

          results.push({
            title: job.title,
            company: job.company,
            location: job.location,
            url: job.url,
            source: "linkedin",
            posted_date: job.postedAt ? job.postedAt.toISOString() : null,
            days_ago: null,
          });

          count++;
        });

        console.log(`🔍 role="${role}" loc="${loc}" page=${page} found=${count}`);

        if (count === 0) empty++;
        else empty = 0;

        if (empty >= MAX_CONSECUTIVE_EMPTY) break;
        if (count < PAGE_SIZE) break;

        matched = true;
        start += PAGE_SIZE;
      }
    }
  }

  console.log(`✅ LinkedIn (browserless) scraper finished. totalJobs=${results.length}`);
  return results;
}
