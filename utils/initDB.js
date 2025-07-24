const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const initDb = async () => {
  try {
    const schemaPath = path.join(__dirname, "../modules/schema/setup.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    await pool.query(schema);
    console.log(" Database schema initialized ");
  } catch (err) {
    console.error("❌ Failed to initialize database schema:", err);
    process.exit(1);
  }
};

module.exports = initDb;
