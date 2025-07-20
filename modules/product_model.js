const pool = require('../db');

async function getAllProducts() {
  const res = await pool.query('SELECT * FROM products');
  return res.rows;
}

module.exports = { getAllProducts };
