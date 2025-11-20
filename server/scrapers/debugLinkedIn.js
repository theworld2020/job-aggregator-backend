import * as cheerio from "cheerio";

const url = "https://www.linkedin.com/jobs/search/?keywords=Product%20Manager&location=Bengaluru%2C%20Karnataka%2C%20India";

const resp = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
  },
});

console.log("STATUS:", resp.status);

const html = await resp.text();

// Save the raw HTML
import fs from "fs";
fs.writeFileSync("linkedin_debug.html", html);

console.log("Saved raw HTML to linkedin_debug.html");
