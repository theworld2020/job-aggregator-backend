import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db/db.js";
import jobsRouter from "./routes/jobs.js";
import scrapeRouter from "./routes/scrape.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* ✅ Fully open, resilient CORS setup (for Looker Studio, Render, Vercel, localhost) */
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
    if (!origin) return callback(null, true); // allow curl / server-to-server
    if (
      allowedOrigins.includes(origin) ||
      origin.includes("googleusercontent.com")
    ) {
      callback(null, true);
    } else {
      console.log("❌ CORS Blocked Origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-scrape-secret"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Preflight requests
app.use(express.json());

/* 🩵 Global fallback CORS headers */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, x-scrape-secret"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next();
});

/* 🩺 Health check */
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

/* 🧠 API routes */
app.use("/api/jobs", jobsRouter);
app.use("/api/scrape", scrapeRouter);

/* 🚀 Start server */
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

/* 💓 Keep-alive ping for Neon */
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
