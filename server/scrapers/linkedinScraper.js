// server/scrapers/linkedinScraper.js
import * as cheerio from "cheerio";

/**
 * Robust LinkedIn Guest API scraper (stable production version)
 *
 * - Uses LinkedIn "guest" API endpoint that returns HTML (no JS required)
 * - Pagination via start=0,25,50...
 * - User-Agent rotation + retries + exponential backoff
 * - Multi-location fallback attempts
 * - Stops safely after consecutive empty pages or max pages
 *
 * Signature unchanged:
 *   linkedinScraper(roles, city, lastRun)
 *
 * Returns array of objects:
 * { title, company, location, url, source: "linkedin", posted_date, days_ago }
 */

/* ---------------------------
   Config
   --------------------------- */
const USER_AGENTS = [
  // a small rotation of realistic UAs
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.90 Safari/537.36",
];

const PAGE_SIZE = 25;           // linkedIn guest api returns ~25 per page
const MAX_PAGES = 8;           // avoid infinite long scrapes (cap: 8 pages ~200 results)
const MAX_CONSECUTIVE_EMPTY = 3; // stop after N consecutive empty pages
const RETRIES = 4;             // number of retries per request
const RETRY_BASE_DELAY_MS = 800; // base backoff delay (exponential)
const PAGE_DELAY_MS = 1400;    // delay between fetching pages (randomized +/- 300ms)

/* ---------------------------
   Helpers
   --------------------------- */
function normalizeCity(city) {
  if (!city || typeof city !== "string") return "Bengaluru, Karnataka, India";
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
  // rotate UA by index provided (so consecutive pages vary UAs)
  return USER_AGENTS[i % USER_AGENTS.length];
}

async function fetchWithRetries(url, opts = {}, attempt = 0) {
  let lastErr = null;
  for (let i = 0; i < RETRIES; i++) {
    try {
      const res = await fetch(url, opts);
      // treat 200-299 as success, treat 403/429 as temporary and retry
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status}`);
      // for 429/403 we will retry
      if (res.status === 429 || res.status === 403 || res.status >= 500) {
        const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, i) + randomInt(0, 400);
        await sleep(backoff);
        continue;
      } else {
        // non-retryable (e.g., 404) - return the response anyway
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

/* ---------------------------
   Parsing helpers
   --------------------------- */
function parseJobCard(el, $) {
  // robust selectors: handle variations of card classes
  const title =
    $(el).find(".base-search-card__title").text().trim() ||
    $(el).find(".result-card__title").text().trim() ||
    $(el).find("[data-test-job-title]").text().trim() ||
    "";

  const company =
    $(el).find(".base-search-card__subtitle").text().trim() ||
    $(el).find(".result-card__subtitle").text().trim() ||
    $(el).find(".result-card__subtitle.job-result-card__subtitle").text().trim() ||
    $(el).find(".company-name").text().trim() ||
    "";

  const locationText =
    $(el).find(".job-search-card__location").text().trim() ||
    $(el).find(".result-card__location").text().trim() ||
    $(el).find("[data-test-job-location]").text().trim() ||
    "";

  let link = $(el).find("a.base-card__full-link").attr("href") || $(el).find("a.result-card__full-card-link").attr("href") || "";
  // ensure absolute URL
  if (link && link.startsWith("//")) link = "https:" + link;

  const postedText = $(el).find("time").attr("datetime") || $(el).find("time").text().trim() || null;
  const postedAt = postedText ? new Date(postedText) : null;

  return {
    title,
    company,
    location: locationText,
    url: link,
    postedAt,
  };
}

/* ---------------------------
   Main exported function
   --------------------------- */
export async function linkedinScraper(roles, city, lastRun) {
  console.log(`🟦 LinkedIn (stable) scraper starting — lastRun=${lastRun} — city="${city}"`);

  const normalizedCity = normalizeCity(city || "Bengaluru");
  const results = [];

  // Multi-location fallback tries (order matters) — keep city-first then fallback to generic
  const locationFallbacks = [
    normalizedCity,
    // alternate forms sometimes pass better
    normalizedCity.replace("Bengaluru", "Bangalore"),
    "India",
  ];

  // For each role, iterate through fallbacks until we successfully scrape something
  for (const role of roles) {
    let scrapedForRole = false;

    for (let locIdx = 0; locIdx < locationFallbacks.length && !scrapedForRole; locIdx++) {
      const targetLocation = locationFallbacks[locIdx];
      const encodedRole = encodeURIComponent(role);
      const encodedLocation = encodeURIComponent(targetLocation);

      let start = 0;
      let consecutiveEmpty = 0;

      for (let page = 0; page < MAX_PAGES; page++) {
        // rotate User-Agent by page index
        const ua = pickUserAgent(page + locIdx);
        const apiUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodedRole}&location=${encodedLocation}&start=${start}`;

        // small random delay before page fetch to mimic human scroll
        const jitter = randomInt(-250, 250);
        await sleep(Math.max(0, PAGE_DELAY_MS + jitter));

        try {
          const resp = await fetchWithRetries(apiUrl, {
            headers: {
              "User-Agent": ua,
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
            },
            // no-cache to reduce CDN/edge sticky responses
            cache: "no-store",
          });

          if (!resp) {
            console.warn("⚠️ Empty response object from fetchWithRetries");
            consecutiveEmpty++;
            if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) break;
            continue;
          }

          const text = await resp.text();

          // if very small HTML, likely blocked or empty — retry/backoff handled in fetchWithRetries
          if (!text || text.trim().length < 200) {
            console.warn(`⚠️ Small/empty HTML for ${apiUrl} (len=${text ? text.length : 0})`);
            consecutiveEmpty++;
            if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) break;
            // try next page after delay
            start += PAGE_SIZE;
            continue;
          }

          // Parse HTML page for cards
          const $ = cheerio.load(text);
          // guest API returns li elements or base-card depending on template: handle both
          const cards = $(".base-card, li.result-card, .job-card-container, .job-result-card");
          let pageCount = 0;

          // If the guest API returned a fragment with <li> job elements, parse them
          if (cards.length === 0) {
            // Some variations use 'article' or 'div' with job-result style
            const altCards = $("article, .jobs-search-results__list-item, .jobs-search__results-list li");
            altCards.each((i, el) => {
              const parsed = parseJobCard(el, $);
              if (!parsed.title && !parsed.company) return;
              // incremental filter
              if (parsed.postedAt && lastRun && parsed.postedAt <= new Date(lastRun)) return;
              results.push({
                title: parsed.title,
                company: parsed.company,
                location: parsed.location,
                url: parsed.url,
                source: "linkedin",
                posted_date: parsed.postedAt ? parsed.postedAt.toISOString() : null,
                days_ago: null,
              });
              pageCount++;
            });
          } else {
            cards.each((i, el) => {
              const parsed = parseJobCard(el, $);
              if (!parsed.title && !parsed.company) return;
              // incremental filter
              if (parsed.postedAt && lastRun && parsed.postedAt <= new Date(lastRun)) return;
              results.push({
                title: parsed.title,
                company: parsed.company,
                location: parsed.location,
                url: parsed.url,
                source: "linkedin",
                posted_date: parsed.postedAt ? parsed.postedAt.toISOString() : null,
                days_ago: null,
              });
              pageCount++;
            });
          }

          console.log(`🔍 role="${role}" loc="${targetLocation}" page=${page} found=${pageCount}`);

          if (pageCount === 0) {
            consecutiveEmpty++;
          } else {
            consecutiveEmpty = 0;
            scrapedForRole = true; // we found at least one job for this role/location
          }

          // stop if we've seen many empty consecutive pages
          if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) {
            console.log(`⚠️ Stopping pages for role="${role}" loc="${targetLocation}" after ${consecutiveEmpty} empty pages`);
            break;
          }

          // stop if the page had fewer than typical (last page)
          if (pageCount < PAGE_SIZE) {
            // likely last page for this query
            break;
          }

          // otherwise go to next page
          start += PAGE_SIZE;
        } catch (err) {
          console.error(`❌ Error fetching LinkedIn page for role="${role}" loc="${targetLocation}" start=${start}:`, err.message || err);
          // on error, increment consecutiveEmpty and decide to break eventually
          consecutiveEmpty++;
          if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) {
            console.log(`⚠️ Too many errors/empty pages. Breaking for role="${role}" loc="${targetLocation}"`);
            break;
          }
        }
      } // end pages loop
    } // end location fallback loop
  } // end roles loop

  console.log(`✅ LinkedIn stable scraper completed. totalJobs=${results.length}`);
  return results;
}
