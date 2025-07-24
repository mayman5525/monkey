// utils/test-db.js

require("dotenv").config(); // Load .env first
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const { Pool } = require("pg");
// Log environment variables to confirm
console.log("📦 Using DB config:", {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

// Create the database connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: {
    rejectUnauthorized: false,
  },
});


(async () => {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log(
      "✅ Connected successfully to DB. Server time:",
      res.rows[0].now
    );
  } catch (err) {
    console.error("❌ DB connection failed:", err.message || err);
  } finally {
    await pool.end(); // Properly close the connection
    console.log("🔌 Connection closed.");
  }
})();
