const pool = require('../db');

async function createForm({ name, phone_number, email }) {
  const res = await pool.query(
    'INSERT INTO forms (name, phone_number, email) VALUES ($1, $2, $3) RETURNING *',
    [name, phone_number, email]
  );
  return res.rows[0];
}

module.exports = { createForm };
