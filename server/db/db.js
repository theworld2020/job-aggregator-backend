import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

console.log("🧠 Connecting to database:", process.env.DATABASE_URL);

let pool;

function createPool() {
  const newPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5, // small pool, good for Neon free tier
    idleTimeoutMillis: 30000, // close idle clients after 30s
    connectionTimeoutMillis: 10000, // fail fast if no response
  });

  newPool.on("error", (err) => {
    console.error("⚠️  Unexpected DB error:", err.message);
    console.log("♻️  Reinitializing Postgres pool...");
    pool = createPool(); // recreate the pool automatically
  });

  return newPool;
}

// initialize pool
pool = createPool();

/* 🧩 Helper function: safely query with auto-retry */
export async function safeQuery(query, params = []) {
  try {
    const client = await pool.connect();
    const result = await client.query(query, params);
    client.release();
    return result;
  } catch (err) {
    console.error("❌ DB query error:", err.message);
    if (err.message.includes("Connection terminated")) {
      console.log("♻️  Attempting to rebuild connection pool...");
      pool = createPool();
    }
    throw err;
  }
}

export default pool;
