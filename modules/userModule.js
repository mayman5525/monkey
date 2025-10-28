const { get_users } = require("../controller/authController");
const pool = require("./db");
const bcrypt = require("bcrypt");

async function createUser({ user_name, user_email, user_number, password }) {
  const passwordHash = await bcrypt.hash(password, 10);

  const query = `
    INSERT INTO users (user_name, user_email, user_number, password_hash)
    VALUES ($1, $2, $3, $4)
    RETURNING id, user_name, user_email, user_number, created_at;
  `;

  const values = [user_name, user_email, user_number, passwordHash];
  const res = await pool.query(query, values);
  return res.rows[0];
}

async function findUserByEmail(email) {
  const res = await pool.query(`SELECT * FROM users WHERE user_email = $1`, [
    email,
  ]);

  return res.rows[0];
}

async function getAllUsers() {
  const res = await pool.query("SELECT * FROM users");
  return res.rows.map((user) => ({
    id: user.id,
    name: user.user_name,
    email: user.user_email,
    number: user.user_number,
    total_orders: user.total_orders,
    is_frequent_visitor: user.is_frequent_visitor,
    created_at: user.created_at,
    updated_at: user.updated_at,
  }));
}
async function get_user_points(user_id) {
  const res = await pool.query(
    `select user_points FROM users WHERE user_id = ${user_id}`
  );
  return res.rows;
}

async function get_user_details_all(user_id) {
  const res = await pool.query(
    "SELECT get_user_full_details($1) AS user_data",
    [user_id]
  );
  return res.rows[0].user_data;
}

module.exports = {
  createUser,
  findUserByEmail,
  get_user_points,
  getAllUsers,
  get_users,
  get_user_details_all,
};
