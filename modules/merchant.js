const pool = require("./db");


class MerchantService {
  static async createMerchant(data) {
    const { merchant_name, merchant_description, merchant_price } = data;

    const result = await pool.query(
      `INSERT INTO merchant (merchant_name, merchant_description, merchant_price, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [merchant_name, merchant_description || null, merchant_price]
    );

    return result.rows[0];
  }

  static async getAllMerchants() {
    const result = await pool.query(
      `SELECT * FROM merchant ORDER BY merchant_id DESC`
    );
    return result.rows;
  }

  static async getMerchantById(id) {
    const result = await pool.query(
      `SELECT * FROM merchant WHERE merchant_id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error("Merchant not found");
    }
    return result.rows[0];
  }

  static async updateMerchant(id, data) {
    const { merchant_name, merchant_description, merchant_price } = data;

    const result = await pool.query(
      `UPDATE merchant 
       SET merchant_name = COALESCE($1, merchant_name),
           merchant_description = COALESCE($2, merchant_description),
           merchant_price = COALESCE($3, merchant_price),
           updated_at = NOW()
       WHERE merchant_id = $4
       RETURNING *`,
      [merchant_name, merchant_description, merchant_price, id]
    );

    if (result.rows.length === 0) {
      throw new Error("Merchant not found");
    }
    return result.rows[0];
  }

  static async deleteMerchant(id) {
    const result = await pool.query(
      `DELETE FROM merchant WHERE merchant_id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error("Merchant not found");
    }
    return result.rows[0];
  }
}

module.exports = MerchantService;
