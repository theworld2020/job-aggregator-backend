// server/scrapers/linkedinScraper.js
import * as cheerio from "cheerio";

/**
 * Normalize cities to LinkedIn-supported format.
 */
function normalizeCity(city) {
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

/**
 * FINAL LINKEDIN SCRAPER — GUEST API (BEST & RELIABLE)
 */
export async function linkedinScraper(roles, city, lastRun) {
  console.log(`🟦 LinkedIn Guest API scraper running. lastRun = ${lastRun}`);

  let allResults = [];
  const normalizedCity = normalizeCity(city);

  for (const role of roles) {
    const encodedRole = encodeURIComponent(role);
    const encodedCity = encodeURIComponent(normalizedCity);

    let start = 0;
    let hasMore = true;

    while (hasMore) {
      const apiUrl =
        `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search` +
        `?keywords=${encodedRole}&location=${encodedCity}&start=${start}`;

      console.log("🔗 Fetching:", apiUrl);

      const resp = await fetch(apiUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
        },
      });

      if (!resp.ok) {
        console.warn(`⚠️ Guest API failed ${resp.status}`);
        break;
      }

      const html = await resp.text();

      // When no more jobs:
      if (!html || html.trim() === "") {
        hasMore = false;
        break;
      }

      const $ = cheerio.load(html);

      let pageCount = 0;

      $(".base-card").each((_, el) => {
        pageCount++;

        const title = $(el)
          .find(".base-search-card__title")
          .text()
          .trim();
        const company = $(el)
          .find(".base-search-card__subtitle")
          .text()
          .trim();
        const locationText = $(el)
          .find(".job-search-card__location")
          .text()
          .trim();
        const link = $(el)
          .find("a.base-card__full-link")
          .attr("href");

        const postedText = $(el).find("time").attr("datetime");
        const postedAt = postedText ? new Date(postedText) : null;

        // Incremental filter
        if (lastRun && postedAt && postedAt <= new Date(lastRun)) {
          return;
        }

        allResults.push({
          title,
          company,
          location: locationText,
          url: link,
          source: "linkedin",
          posted_date: postedAt ? postedAt.toISOString() : null,
          days_ago: null,
        });
      });

      console.log(`📄 Page had ${pageCount} jobs.`);
      start += 25; // next page
    }
  }

  console.log(`✅ FINAL: LinkedIn extracted ${allResults.length} jobs.`);
  return allResults;
}
