export async function linkedinScraper(roles, city, lastRun) {
  let allJobs = [];

  for (const role of roles) {
    const url = `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(
      role + " " + city
    )}`;

    console.log("🔗 LinkedIn Fetching:", url);

    const html = await fetch(url).then(r => r.text());
    const $ = cheerio.load(html);

    $(".base-card").each((_, el) => {
      const title = $(el).find(".base-search-card__title").text().trim();
      const company = $(el).find(".base-search-card__subtitle").text().trim();
      const location = $(el).find(".job-search-card__location").text().trim();
      const url = $(el).find("a.base-card__full-link").attr("href");

      const postedText = $(el).find("time").attr("datetime"); // ISO format

      const postedDate = postedText ? new Date(postedText) : null;

      // ⏳ FILTER: Only return jobs after lastRun
      if (lastRun && postedDate && postedDate <= new Date(lastRun)) {
        return;
      }

      allJobs.push({
        title,
        company,
        location,
        url,
        posted_date: postedDate,
        source: "linkedin",
        days_ago: null,
      });
    });
  }

  console.log(`✅ LinkedIn scraper found ${allJobs.length} jobs.`);
  return allJobs;
}
