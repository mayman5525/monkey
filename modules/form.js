const pool = require("./db");

class FormModel {
  static async create({ name, phone_number, email, messages }) {
    const query = `
      INSERT INTO forms (name, phone_number, email, messages, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, name, phone_number, email, messages, created_at, updated_at
    `;
    const values = [name, phone_number, email, messages];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findByNameOrPhone(name, phone_number) {
    const query = `
      SELECT id, name, phone_number, email, messages, created_at, updated_at
      FROM forms
      WHERE name = $1 OR phone_number = $2
      LIMIT 1
    `;
    const result = await pool.query(query, [name, phone_number]);
    return result.rows[0] || null;
  }

  static async findAll(limit = 50, offset = 0) {
    const query = `
      SELECT id, name, phone_number, email, messages, created_at, updated_at
      FROM forms
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  }

  static async findById(id) {
    const query = `
      SELECT id, name, phone_number, email, messages, created_at, updated_at
      FROM forms
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async count() {
    const query = "SELECT COUNT(*) as total FROM forms";
    const result = await pool.query(query);
    return parseInt(result.rows[0].total);
  }
}

module.exports = FormModel;
