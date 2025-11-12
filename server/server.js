import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db/db.js";
import jobsRouter from "./routes/jobs.js";
import scrapeRouter from "./routes/scrape.js"; // if you have /api/scrape endpoint

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* ✅ Configure CORS properly */
const allowedOrigins = [
  "https://datastudio.google.com",  // Google Data Studio / Looker Studio
  "https://lookerstudio.google.com",
  "https://script.google.com",      // Google Apps Script frontend
  "http://localhost:3000",          // Local testing
  "http://127.0.0.1:3000",
  "https://job-aggregator-frontend.vercel.app", // your own domain (optional)
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.includes("googleusercontent.com")) {
      callback(null, true);
    } else {
      console.log("❌ Blocked by CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-scrape-secret"],
};

// ✅ Middleware
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Preflight requests
app.use(express.json());

/* 🩺 Health Check Endpoint */
app.get("/api/health", async (req, res) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), 5000)
  );

  try {
    const check = pool.connect().then(async (client) => {
      const result = await client.query("SELECT NOW()");
      client.release();
      return result;
    });

    const result = await Promise.race([check, timeout]);
    res.json({
      status: "ok",
      db: "connected",
      time: result?.rows?.[0]?.now || new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Health check error:", err.message);
    res.status(500).json({
      status: "error",
      db: err.message === "Timeout" ? "timeout" : "disconnected",
    });
  }
});

/* 🧠 Main API Routes */
app.use("/api/jobs", jobsRouter);     // job fetching and upload
app.use("/api/scrape", scrapeRouter); // job scraping trigger

/* 🖥️ Root Endpoint */
app.get("/", (req, res) => {
  res.send("🚀 Job Aggregator Backend is running successfully!");
});

/* ✅ Start the Server */
app.listen(PORT, "0.0.0.0", async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Connected to PostgreSQL successfully!");
    client.release();
  } catch (err) {
    console.error("❌ PostgreSQL connection failed:", err.message);
  }
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});
