const express = require("express");
const { Client } = require("pg");

const app = express();
const PORT = 3000;

// const PG_CONFIG = {
//   user: "monkey_yh8b_user",
//   host: "dpg-d1s13dbe5dus73flrro0-a",
//   database: "monkey_yh8b",
//   password: "QlfrzgJ6LZMlDVlr6ZIj2IOsyCoQzXiF",
//   port: 5432,
// };

const client = new Client(
);

client
  .connect()
  .then(() => {
    console.log("Connected to PostgreSQL");
  })
  .catch((err) => {
    console.error("PostgreSQL connection error:", err);
  });

app.get("/", (req, res) => {
  res.send("App and database connectivity test successful!");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
