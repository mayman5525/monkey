const pool = require('../db');

async function getAllUsers() {
  const res = await pool.query('SELECT * FROM users');
  return res.rows;
}

module.exports = { getAllUsers };
