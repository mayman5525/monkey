const pool = require("./db");

class MerchantService {
  static async createMerchant(data) {
    console.log(
      "🔍 MerchantService.createMerchant received data keys:",
      Object.keys(data)
    );
    console.log("📸 Photo data exists?", !!data.photo_data);
    console.log("📸 Photo mime type:", data.photo_mime_type);

    const {
      merchant_name,
      merchant_description,
      merchant_price,
      merchant_category,
      merchant_photo,
      photo_data,
      photo_mime_type,
    } = data;

    const result = await pool.query(
      `INSERT INTO merchant (
        merchant_name, 
        merchant_description, 
        merchant_price, 
        merchant_category,
        merchant_photo,
        photo_data,
        photo_mime_type,
        created_at, 
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *`,
      [
        merchant_name,
        merchant_description || null,
        merchant_price,
        merchant_category || null,
        merchant_photo || null,
        photo_data || null,
        photo_mime_type || null,
      ]
    );

    console.log(
      "✅ Merchant created with photo_data length:",
      result.rows[0].photo_data?.length
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
    const {
      merchant_name,
      merchant_description,
      merchant_price,
      merchant_category,
      merchant_photo,
      photo_data,
      photo_mime_type,
    } = data;

    const result = await pool.query(
      `UPDATE merchant 
      SET 
        merchant_name = COALESCE($1, merchant_name),
        merchant_description = COALESCE($2, merchant_description),
        merchant_price = COALESCE($3, merchant_price),
        merchant_category = COALESCE($4, merchant_category),
        merchant_photo = COALESCE($5, merchant_photo),
        photo_data = COALESCE($6, photo_data),
        photo_mime_type = COALESCE($7, photo_mime_type),
        updated_at = NOW()
      WHERE merchant_id = $8
      RETURNING *`,
      [
        merchant_name,
        merchant_description,
        merchant_price,
        merchant_category,
        merchant_photo,
        photo_data,
        photo_mime_type,
        id,
      ]
    );

    if (result.rows.length === 0) {
      throw new Error("Merchant not found");
    }
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
