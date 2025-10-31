const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  keepAlive: true, // helps prevent “Connection terminated unexpectedly”
});

const initDb = async () => {
  let errors = false;
  try {
    const schemaDir = path.join(__dirname, "../modules/schema");
    const files = fs
      .readdirSync(schemaDir)
      .filter((file) => file.endsWith(".sql"))
      .sort(); // Sort files to ensure consistent order (e.g., 01_setup.sql, 02_alter_orders_table.sql)

    for (const file of files) {
      try {
        const schemaPath = path.join(schemaDir, file);
        const schema = fs.readFileSync(schemaPath, "utf8");
        await pool.query(schema);
        console.log(`✅ Database schema initialized from ${file}`);
      } catch (err) {
        console.error(
          `❌ Failed to initialize schema from ${file}:`,
          err.message
        );
        errors = true;
      }
    }

    if (errors) {
      console.error(
        "⚠️ Some schema files failed to initialize. Check logs for details."
      );
    } else {
      console.log("✅ All database schemas initialized successfully");
    }
  } catch (err) {
    console.error("❌ Failed to read schema directory:", err.message);
    errors = true;
  }

  if (errors) {
    console.error(
      "⚠️ Database initialization completed with errors. Application continuing..."
    );
  }
};
module.exports = initDb;
