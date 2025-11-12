import axios from "axios";
import * as cheerio from "cheerio";


/**
 * LinkedIn Scraper — uses proper location parameter and pagination
 */
export default async function linkedinScraper(roles, city) {
  console.log("🟦 Running LinkedIn scraper for:", roles.join(", "), "in", city);

  const allJobs = [];

  for (const role of roles) {
    const encodedRole = encodeURIComponent(role);
    const encodedCity = encodeURIComponent(city);

    // Fetch up to 5 pages (25 jobs per page)
    for (let start = 0; start < 125; start += 25) {
      const url = `https://www.linkedin.com/jobs/search?keywords=${encodedRole}&location=${encodedCity}&start=${start}`;
      console.log("🔗 Fetching:", url);

      try {
        const { data } = await axios.get(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
          },
        });

        const $ = cheerio.load(data);
        const jobCards = $(".base-card");

        if (jobCards.length === 0) {
          console.log(`⚠️ No jobs found for ${role} on page starting ${start}.`);
          break;
        }

        jobCards.each((_, el) => {
          const title = $(el).find(".base-search-card__title").text().trim();
          const company = $(el)
            .find(".base-search-card__subtitle")
            .text()
            .trim();
          const location = $(el)
            .find(".job-search-card__location")
            .text()
            .trim();
          const url = $(el).find("a.base-card__full-link").attr("href");
          const timeText = $(el)
            .find("time")
            .attr("datetime") || $(el).find("time").text().trim();

          if (title && company && url) {
            allJobs.push({
              title,
              company,
              location,
              url,
              source: "LinkedIn",
              posted_date: timeText || null,
            });
          }
        });
      } catch (err) {
        console.error(`❌ LinkedIn scrape failed for ${role}:`, err.message);
      }

      await new Promise((r) => setTimeout(r, 1500)); // delay between pages
    }
  }

  console.log(`✅ LinkedIn scraper found ${allJobs.length} jobs.`);
  return allJobs;
}
