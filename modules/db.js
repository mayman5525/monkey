// db.js
const { Pool } = require("pg");
require("dotenv").config();
const logger = require("../utils/logger");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Render external URLs with SSL
  },
});

pool.on("error", (err) => {
  logger.error("Unexpected error on idle client", err);
  process.exit(-1);
});

pool
  .connect()
  .then(() => logger.info("Database connected successfully"))
  .catch((err) => logger.error("Database connection failed:", err));

module.exports = pool;
