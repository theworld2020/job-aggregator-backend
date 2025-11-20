import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db/db.js";
import jobsRouter from "./routes/jobs.js";
import scrapeRouter from "./routes/scrape.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* ============================================================
   ⭐ FINAL FIXED CORS CONFIGURATION
   - Allows Cronhooks.io
   - Allows curl (Origin:null)
   - Allows server-to-server requests
   - Allows Looker Studio + your frontend
   - DOES NOT BLOCK on unknown origins anymore
============================================================ */
const allowedOrigins = [
  "https://datastudio.google.com",
  "https://lookerstudio.google.com",
  "https://script.google.com",
  "https://job-aggregator-frontend.vercel.app",
  "https://job-aggregator-backend-oo5v.onrender.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const corsOptions = {
  origin: (origin, callback) => {
    // 🟢 Allow server-to-server (curl, Cronhooks)
    if (!origin || origin === "null") {
      return callback(null, true);
    }

    // 🟢 Allow Cronhooks.io
    if (origin.includes("cronhooks")) {
      return callback(null, true);
    }

    // 🟢 Allow whitelisted browser origins
    if (
      allowedOrigins.includes(origin) ||
      origin.includes("googleusercontent.com")
    ) {
      return callback(null, true);
    }

    // 🟡 DO NOT BLOCK — allow but log (important!)
    console.log("⚠️ Unknown Origin Allowed:", origin);
    return callback(null, true);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-scrape-secret"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Preflight

/* ============================================================
   JSON Body Parsing
============================================================ */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ============================================================
   Global fallback CORS headers
============================================================ */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, x-scrape-secret"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next();
});

/* ============================================================
   Health Check Endpoint
============================================================ */
app.get("/api/health", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW()");
    client.release();

    res.json({
      status: "ok",
      db: "connected",
      time: result.rows[0].now,
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

/* ============================================================
   API Routes
============================================================ */
app.use("/api/jobs", jobsRouter);
app.use("/api/scrape", scrapeRouter);

/* ============================================================
   Start Server
============================================================ */
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  try {
    const client = await pool.connect();
    console.log("✅ Connected to PostgreSQL successfully!");
    client.release();
  } catch (err) {
    console.error("❌ Database connection error:", err.message);
  }
});

/* ============================================================
   Keep-alive ping for Neon
============================================================ */
setInterval(async () => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("💓 DB Keep-alive ping successful", new Date().toISOString());
  } catch (err) {
    console.error("⚠️ DB Keep-alive ping failed:", err.message);
  }
}, 5 * 60 * 1000);
