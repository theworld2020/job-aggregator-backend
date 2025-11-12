import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db/db.js";
import jobsRouter from "./routes/jobs.js";
import scrapeRouter from "./routes/scrape.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* ✅ Universal CORS Configuration for Studio + Frontend + Local */
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      "https://datastudio.google.com",
      "https://lookerstudio.google.com",
      "https://script.google.com",
      "https://job-aggregator-backend-oo5v.onrender.com",
      "https://job-aggregator-frontend.vercel.app",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ];

    if (!origin || allowedOrigins.includes(origin) || origin.includes("googleusercontent.com")) {
      callback(null, true);
    } else {
      console.log("❌ CORS Blocked:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-scrape-secret"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Preflight support

// ✅ Fallback CORS headers (safety net)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-scrape-secret");
  next();
});

app.use(express.json());

/* 🩺 Health check route — verifies DB and uptime */
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

/* 🧠 API routes */
app.use("/api/jobs", jobsRouter);
app.use("/api/scrape", scrapeRouter);

/* 🚀 Start the server */
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

/* 💓 Periodic DB ping to prevent Neon idle disconnects */
setInterval(async () => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("💓 DB Keep-alive ping successful");
  } catch (err) {
    console.error("⚠️ DB Keep-alive ping failed:", err.message);
  }
}, 5 * 60 * 1000); // every 5 minutes
