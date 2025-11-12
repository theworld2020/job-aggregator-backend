require('dotenv').config();
const { Pool } = require('pg');

// Create a connection pool to Neon PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Export for other modules
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};

// Optional: Log a one-time success message when the app starts
pool.connect()
  .then(client => {
    return client.query('SELECT NOW()')
      .then(res => {
        console.log('✅ Connected to Neon PostgreSQL:', res.rows[0].now);
        client.release();
      })
      .catch(err => {
        client.release();
        console.error('❌ Database connection failed:', err.message);
      });
  })
  .catch(err => console.error('❌ Could not connect to DB:', err.message));
