const { Client } = require("pg");

// Replace with your actual Postgres connection URL
const connectionString = `postgresql://monkey_yh8b_user:QlfrzgJ6LZMlDVlr6ZIj2IOsyCoQzXiF@dpg-d1s13dbe5dus73flrro0-a/monkey_yh8b`;

async function testConnection() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL database successfully!");
    const res = await client.query("SELECT NOW()");
    console.log("Server time:", res.rows[0]);
  } catch (err) {
    console.error("Connection error:", err.stack);
  } finally {
    await client.end();
  }
}

testConnection();
