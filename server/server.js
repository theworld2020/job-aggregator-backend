import pool from "./db/db.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jobsRouter from "./routes/jobs.js"; // ✅ only one import

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* 🩺 Health check route — with timeout */
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

// 🧠 Jobs route
app.use("/api/jobs", jobsRouter);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});
