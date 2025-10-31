const pool = require("./db");

class MerchantService {
  static async createMerchant({
    merchant_name,
    merchant_description,
    merchant_price,
    merchant_category,
    merchant_photo,
    photo_public_id,
  }) {
    const result = await pool.query(
      `INSERT INTO merchant (
      merchant_name, 
      merchant_description, 
      merchant_price, 
      merchant_category,
      merchant_photo,
      photo_public_id,
      created_at, 
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    RETURNING *`,
      [
        merchant_name,
        merchant_description || null,
        merchant_price,
        merchant_category || null,
        merchant_photo || null,
        photo_public_id || null,
      ]
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

  static async updateMerchant(
    id,
    {
      merchant_name,
      merchant_description,
      merchant_price,
      merchant_category,
      merchant_photo,
      photo_public_id,
    }
  ) {
    const result = await pool.query(
      `UPDATE merchant 
     SET 
       merchant_name = COALESCE($1, merchant_name),
       merchant_description = COALESCE($2, merchant_description),
       merchant_price = COALESCE($3, merchant_price),
       merchant_category = COALESCE($4, merchant_category),
       merchant_photo = COALESCE($5, merchant_photo),
       photo_public_id = COALESCE($6, photo_public_id),
       updated_at = NOW()
     WHERE merchant_id = $7
     RETURNING *`,
      [
        merchant_name,
        merchant_description,
        merchant_price,
        merchant_category,
        merchant_photo,
        photo_public_id,
        id,
      ]
    );

    if (result.rows.length === 0) throw new Error("Merchant not found");
    return result.rows[0];
  }

  static async updateMerchantPhoto(id, photo_data, photo_mime_type) {
    const result = await pool.query(
      `UPDATE merchant 
      SET 
        photo_data = $1,
        photo_mime_type = $2,
        updated_at = NOW()
      WHERE merchant_id = $3
      RETURNING *`,
      [photo_data, photo_mime_type, id]
    );

    if (result.rows.length === 0) {
      throw new Error("Merchant not found");
    }
    return result.rows[0];
  }

  static async deleteMerchantPhoto(id) {
    const result = await pool.query(
      `UPDATE merchant 
      SET 
        photo_data = NULL,
        photo_mime_type = NULL,
        updated_at = NOW()
      WHERE merchant_id = $1
      RETURNING *`,
      [id]
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
