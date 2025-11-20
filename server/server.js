import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db/db.js";
import jobsRouter from "./routes/jobs.js";
import scrapeRouter from "./routes/scrape.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =============================================================
   ⭐ TRUSTED BROWSER ORIGINS
   Backend-to-backend + curl must always pass,
   so we never BLOCK unknown origins — we only log them.
============================================================= */
const allowedOrigins = [
  "https://datastudio.google.com",
  "https://lookerstudio.google.com",
  "https://script.google.com",
  "https://job-aggregator-frontend.vercel.app",
  "https://job-aggregator-backend-oo5v.onrender.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

/* =============================================================
   ⭐ FINAL CORS CONFIG — GUARANTEED NO MORE FORBIDDEN
============================================================= */
const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server (curl / Cronhooks / API clients)
    if (!origin || origin === "null") {
      return callback(null, true);
    }

    // Allow Cronhooks
    if (origin.includes("cronhooks")) {
      return callback(null, true);
    }

    // Allow trusted browser origins
    if (
      allowedOrigins.includes(origin) ||
      origin.includes("googleusercontent.com")
    ) {
      return callback(null, true);
    }

    // Allow all (important: DO NOT BLOCK)
    console.log("⚠️ Allowed unknown origin (safe):", origin);
    return callback(null, true);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-scrape-secret"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Preflight handling

/* =============================================================
   ⭐ BODY PARSING
============================================================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =============================================================
   ⭐ GLOBAL FALLBACK HEADERS — DOES NOT BLOCK
============================================================= */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, x-scrape-secret"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next();
});

/* =============================================================
   🔍 HEALTH CHECK
============================================================= */
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

/* =============================================================
   🔗 ROUTES
==========================================================
