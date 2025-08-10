const pool = require('./db');
const bcrypt = require('bcrypt');

async function createUser({ user_id, user_name, user_email, user_number, password }) {
  const passwordHash = await bcrypt.hash(password, 10);

  const query = `
    INSERT INTO users (user_id, user_name, user_email, user_number, password_hash)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, user_id, user_name, user_email, user_number, created_at;
  `;

  const values = [user_id, user_name, user_email, user_number, passwordHash];
  const res = await pool.query(query, values);
  return res.rows[0];
}

async function findUserByEmail(email) {
  const res = await pool.query(`SELECT * FROM users WHERE user_email = $1`, [email]);
  return res.rows[0];
}

async function getAllUsers() {
  const res = await pool.query('SELECT * FROM users');
  return res.rows;
}
async function get_user_points(user_id) {
  const res = await pool.query(`select user_points FROM users WHERE user_id = ${user_id}`)
  return res.rows
}


module.exports = { createUser, findUserByEmail };
module.exports = { getAllUsers ,get_user_points};
