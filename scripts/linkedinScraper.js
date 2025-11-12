import axios from "axios";
import cheerio from "cheerio";
import fs from "fs";

async function linkedinScraper(roles, city) {
  const results = [];

  for (const role of roles) {
    for (let page = 0; page < 3; page++) {
      const start = page * 25;
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(
        role
      )}&location=${encodeURIComponent(city)}&f_TPR=r604800&start=${start}`;

      console.log(`🌐 Fetching ${url}`);

      try {
        const { data: html } = await axios.get(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
          },
        });

        const $ = cheerio.load(html);
        const cards = $(".base-card");
        if (cards.length === 0) break;

        cards.each((_, el) => {
          const title = $(el).find(".base-search-card__title").text().trim();
          const company = $(el).find(".base-search-card__subtitle").text().trim();
          const location = $(el).find(".job-search-card__location").text().trim();
          const url = $(el).find("a.base-card__full-link").attr("href");
          const timeText = $(el).find("time").text().trim() || "0 days ago";

          let days_ago = 0;
          const match = timeText.match(/(\d+)\s+day/);
          if (match) days_ago = parseInt(match[1]);
          const posted_date = new Date();
          posted_date.setDate(posted_date.getDate() - days_ago);

          if (title && company) {
            results.push({
              title,
              company,
              location,
              url,
              source: "linkedin",
              posted_date: posted_date.toISOString(),
              days_ago,
            });
          }
        });

        console.log(`✅ Page ${page + 1}: ${cards.length} jobs found`);
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        console.error("❌ Error scraping page:", err.message);
      }
    }
  }

  console.log(`🎯 Total jobs scraped: ${results.length}`);
  fs.writeFileSync("output.json", JSON.stringify(results, null, 2));
  return results;
}

linkedinScraper(
  ["Product Manager", "Senior Product Manager", "Product Owner", "Senior Product Owner"],
  "Bengaluru, Karnataka, India"
);
