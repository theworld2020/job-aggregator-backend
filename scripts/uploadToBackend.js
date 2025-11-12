import axios from "axios";
import fs from "fs";

const BACKEND_URL = "https://job-aggregator-backend-oo5v.onrender.com/api/jobs/upload";
const SCRAPE_SECRET = "S3cureScrape!2025";

async function uploadData() {
  const jobs = JSON.parse(fs.readFileSync("output.json", "utf-8"));
  if (!jobs.length) return console.log("⚠️ No jobs found in output.json");

  try {
    const res = await axios.post(
      BACKEND_URL,
      { jobs },
      {
        headers: {
          "Content-Type": "application/json",
          "x-scrape-secret": SCRAPE_SECRET,
        },
      }
    );
    console.log("✅ Uploaded successfully:", res.data);
  } catch (err) {
    console.error("❌ Upload failed:", err.message);
  }
}

uploadData();
