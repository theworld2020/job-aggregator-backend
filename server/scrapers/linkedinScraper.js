const axios = require("axios");
const cheerio = require("cheerio");

async function getFreeProxy() {
  try {
    const res = await axios.get("https://www.proxy-list.download/api/v1/get?type=https");
    const proxies = res.data.split("\n").filter(Boolean);
    const random = proxies[Math.floor(Math.random() * proxies.length)];
    console.log("🌍 Using proxy:", random);
    return random.trim();
  } catch (err) {
    console.warn("⚠️ Failed to fetch proxy, using direct connection");
    return null;
  }
}

module.exports = async function linkedinScraper(roles, city) {
  console.log("🔍 Starting LinkedIn scraper for", roles.join(", "), city);
  const results = [];
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml",
  };

  for (const role of roles) {
    try {
      const query = encodeURIComponent(`${role} ${city}`);
      let page = 0;
      let totalFound = 0;
      const proxy = await getFreeProxy();

      const proxyConfig = proxy
        ? {
            proxy: {
              host: proxy.split(":")[0],
              port: parseInt(proxy.split(":")[1]),
            },
          }
        : {};

      while (page < 3) {
        const start = page * 25;
        const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${query}&location=${encodeURIComponent(
          city
        )}&f_TPR=r604800&start=${start}`;

        console.log(`🌐 Fetching page ${page + 1}/3`);
        const { data: html } = await axios.get(url, {
          headers,
          timeout: 10000,
          ...proxyConfig,
        });

        const $ = cheerio.load(html);
        const cards = $(".base-card");

        if (cards.length === 0) {
          console.log("⚠️ No job cards found, skipping further pages");
          break;
        }

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

        totalFound += cards.length;
        console.log(`✅ Page ${page + 1}: ${cards.length} jobs found`);
        page++;
        await new Promise((r) => setTimeout(r, 1500));
      }

      console.log(`🎯 Total found for ${role}: ${totalFound}`);
    } catch (err) {
      console.error(`❌ LinkedIn scrape failed for ${role}:`, err.message);
    }
  }

  console.log(`✅ LinkedIn scraper collected ${results.length} jobs`);
  return results;
};
