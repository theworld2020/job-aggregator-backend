/*
 server/scrapers/naukriScraper.js
 Naukri scraper (production-ready)
*/
import * as cheerio from "cheerio";
import fs from "fs";

const PAGE_SIZE = 20;           // Naukri's default per page (approx)
const MAX_PAGES = 6;           // keep conservative to avoid heavy load
const RETRIES = 3;
const RETRY_BASE_MS = 700;
const PAGE_DELAY_MS = 900;     // delay between pages to behave politely

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
async function fetchWithRetries(url, opts = {}, maxRetries = RETRIES) {
  let lastErr = null;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const res = await fetch(url, opts);
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status}`);
      // retry on server errors
      if (res.status >= 500 || res.status === 429) {
        const backoff = RETRY_BASE_MS * Math.pow(2, i) + rand(0, 300);
        await sleep(backoff);
        continue;
      } else {
        // client error (4xx) — return response so caller can decide
        return res;
      }
    } catch (err) {
      lastErr = err;
      const backoff = RETRY_BASE_MS * Math.pow(2, i) + rand(0, 300);
      await sleep(backoff);
    }
  }
  throw lastErr || new Error("fetchWithRetries failed");
}

/**
 * tryExtractPostedDate(text)
 * - Attempts to parse posted date phrases from Naukri (like "2 days ago", "Posted a day ago")
 * - As a fallback returns null
 */
function tryExtractPostedDate(text) {
  if (!text || typeof text !== "string") return null;
  const t = text.toLowerCase();
  // common patterns: "2 days ago", "3 hours ago", "Posted a day ago"
  let m = t.match(/(\d+)\s+day/);
  if (m) {
    const days = parseInt(m[1], 10);
    return new Date(Date.now() - days * 24 * 3600 * 1000);
  }
  m = t.match(/(\d+)\s+hour/);
  if (m) {
    const hours = parseInt(m[1], 10);
    return new Date(Date.now() - hours * 3600 * 1000);
  }
  if (t.includes("yesterday") || t.includes("a day ago") || t.includes("posted a day ago")) {
    return new Date(Date.now() - 24 * 3600 * 1000);
  }
  if (t.includes("just now") || t.includes("few seconds") || t.includes("minutes ago")) {
    return new Date();
  }
  return null;
}

/**
 * parseJobElement($el, $)
 * - returns { title, company, location, url, postedAt (Date|null) }
 */
function parseJobElement($el, $) {
  // Naukri often uses .jobTuple or .list or .jobsearch
  // Try flexible selectors and fallbacks
  const title =
    $el.find("a.title, .jobTuple a.title, .jobTuple h2 a, .list h3 a").first().text().trim() ||
    $el.find(".jobTitle").text().trim() ||
    "";

  const company =
    $el.find(".subTitle, .company, .companyInfo, a.subTitle").first().text().trim() ||
    $el.find(".orgName").text().trim() ||
    "";

  // location can be inside .location, .loc, .jobTuple .loc, or within metadata
  const location =
    $el.find(".loc, .jobTuple .loc, .location, .info .loc").first().text().trim() ||
    $el.find(".location").text().trim() ||
    "";

  let link = $el.find("a.title, .jobTuple a.title, .jobTuple h2 a, .list h3 a").first().attr("href") || "";
  if (link && link.startsWith("//")) link = "https:" + link;
  if (link && link.startsWith("/")) link = "https://www.naukri.com" + link;

  // posted info: sometimes .date, .postedDate, small tag etc.
  const postedText =
    $el.find(".date, .postedDate, .jobTuple .meta, .list .jobMeta").first().text().trim() ||
    $el.find("span.date").text().trim() ||
    "";

  const postedAt = tryExtractPostedDate(postedText);

  return { title, company, location, url: link, postedAt };
}

/**
 * Build Naukri search URL
 * Roles: single role string
 * City: "Bangalore" | "Bengaluru" | "India" etc.
 *
 * We will target Naukri search by keywords + city param
 */
function buildSearchUrl(role, city, start = 0) {
  const q = encodeURIComponent(role);
  const loc = encodeURIComponent(city || "");
  // Naukri search uses 'start' as offset param, and 'k' for keyword, 'l' for location
  // Example: https://www.naukri.com/jobs-in-bangalore?k=product%20manager&l=Bangalore
  // We'll use the job search path that lists results with pagination using start offset.
  if (loc) {
    return `https://www.naukri.com/${loc}-jobs?k=${q}&start=${start}`;
  } else {
    return `https://www.naukri.com/jobs?k=${q}&start=${start}`;
  }
}

/**
 * DEBUG: save HTML to /tmp when SAVE_NAUKRI_DEBUG_HTML=true
 */
function saveDebugHtml(name, html) {
  try {
    if (process.env.SAVE_NAUKRI_DEBUG_HTML === "true") {
      const filename = `/tmp/naukri_debug_${name.replace(/[^\w.-]/g, "_")}.html`;
      fs.writeFileSync(filename, html, "utf-8");
      console.log("💾 Saved Naukri debug HTML →", filename);
    }
  } catch (err) {
    console.warn("⚠️ Failed to save debug HTML:", err.message || err);
  }
}

/**
 * Exported scraper function
 */
export async function naukriScraper(roles, city, lastRun) {
  console.log(`🟧 Naukri scraper running. lastRun=${lastRun}, city=${city}, roles=${roles.join(", ")}`);

  const results = [];

  // ensure roles is array
  roles = Array.isArray(roles) ? roles : [roles];

  // Defensive limits: max roles to avoid explosion (you can adjust)
  const MAX_ROLES_PER_RUN = 4;
  roles = roles.slice(0, MAX_ROLES_PER_RUN);

  for (const role of roles) {
    let consecutiveEmptyPages = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const start = page * PAGE_SIZE;
      const url = buildSearchUrl(role, city, start);

      // Polite delay between pages
      await sleep(PAGE_DELAY_MS + rand(-150, 150));

      try {
        const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        const res = await fetchWithRetries(url, { headers: { "User-Agent": ua, "Accept-Language": "en-US,en;q=0.9" } });

        // If we got a client error (e.g., 403), stop this role early
        if (res.status === 403) {
          console.warn("⚠️ Naukri returned 403 for", url);
          break;
        }

        const html = await res.text();
        saveDebugHtml(`${role}_${city}_start${start}`, html);

        if (!html || html.trim().length < 200) {
          console.warn(`⚠️ Naukri returned small/empty HTML for ${url}`);
          consecutiveEmptyPages++;
          if (consecutiveEmptyPages >= 2) break;
          continue;
        }

        const $ = cheerio.load(html);

        // Naukri uses a variety of result containers. Try multiple selectors:
        const containers = $(".jobTuple, .list, .jobsearch, .jobCard, .jobRow, .jobBlock, li");
        let foundOnPage = 0;

        containers.each((_, el) => {
          try {
            const parsed = parseJobElement($(el), $);
            if (!parsed.title || !parsed.company) return;

            // If postedAt exists and <= lastRun, skip
            if (parsed.postedAt && lastRun) {
              try {
                const last = new Date(lastRun);
                if (parsed.postedAt <= last) return;
              } catch (e) { /* ignore parse issues */ }
            }

            results.push({
              title: parsed.title,
              company: parsed.company,
              location: parsed.location || city || "",
              url: parsed.url,
              source: "naukri",
              posted_date: parsed.postedAt ? parsed.postedAt.toISOString() : null,
              days_ago: null,
            });
            foundOnPage++;
          } catch (err) {
            // ignore per-element errors
          }
        });

        console.log(`🔍 role="${role}" page=${page} found=${foundOnPage}`);

        if (foundOnPage === 0) {
          consecutiveEmptyPages++;
          if (consecutiveEmptyPages >= 2) break;
        } else {
          consecutiveEmptyPages = 0;
        }

        // If less than page size, end (likely last page)
        if (foundOnPage < PAGE_SIZE) break;

      } catch (err) {
        console.error("❌ Naukri fetch error:", err?.message || err);
        // On repeated errors, bail for this role
        consecutiveEmptyPages++;
        if (consecutiveEmptyPages >= 2) break;
      }
    } // page loop
  } // roles loop

  console.log(`✅ Naukri scraper done. totalJobs=${results.length}`);
  return results;
}
