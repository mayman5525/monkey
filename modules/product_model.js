const pool = require("./db");
class ProductModel {
  static async getProducts() {
    const res = await pool.query("SELECT * FROM product");
    return res.rows;
  }
  static async getProductsById(id) {
    const res = await pool.query(
      "SELECT * FROM product WHERE product_id = $1",
      [id]
    );
    return res.rows;
  }
  static async getProductsByCategory(category) {
    const res = await pool.query("SELECT * FROM product WHERE category = $1", [
      category,
    ]);
    return res.rows;
  }
  static async searchProducts(query) {
    const res = await pool.query(
      "SELECT * FROM product WHERE product_name ILIKE $1 OR product_description ILIKE $1",
      [`%${query}%`]
    );
    return res.rows;
  }
  // Create product with photo
  // modules/product_model.js
  // modules/product_model.js
  static async createProduct({
    product_name,
    product_components,
    price,
    category_id,
    category_name, // ← NEW: category name to set product_category
    product_photo,
    is_featured,
    photo_public_id,
  }) {
    const res = await pool.query(
      `INSERT INTO product (
      product_name, product_components, product_price, category_id, product_category,
      product_photo, is_featured, photo_public_id,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    RETURNING 
      product_id, product_name, product_components, product_price, 
      product_category, category_id, product_photo, is_featured, 
      has_points, points, created_at, updated_at`,
      [
        product_name,
        product_components,
        price,
        category_id,
        category_name, // Set product_category with category name
        product_photo,
        is_featured,
        photo_public_id,
      ]
    );
    return res.rows[0];
  }

  static async updateProduct(
    id,
    {
      product_name,
      product_components,
      price,
      category,
      product_photo,
      is_featured,
      photo_public_id,
    }
  ) {
    const res = await pool.query(
      `UPDATE product 
     SET 
       product_name = $1, 
       product_components = $2, 
       product_price = $3, 
       product_category = $4, 
       product_photo = $5, 
       is_featured = $6,
       photo_public_id = $7,
       updated_at = NOW()
     WHERE product_id = $8
     RETURNING *`,
      [
        product_name,
        product_components,
        price,
        category,
        product_photo,
        is_featured,
        photo_public_id,
        id,
      ]
    );

    if (res.rows.length === 0) {
      throw new Error("Product not found");
    }
    return res.rows[0];
  }
  static async deleteProduct(id) {
    // First check if product exists
    const checkRes = await pool.query(
      "SELECT product_id FROM product WHERE product_id = $1",
      [id]
    );
    if (checkRes.rows.length === 0) {
      throw new Error("Product not found");
    }

    // Delete the product (cascade will handle related records)
    const res = await pool.query(
      "DELETE FROM product WHERE product_id = $1 RETURNING *",
      [id]
    );

    if (res.rows.length === 0) {
      throw new Error("Product could not be deleted");
    }
    return res.rows[0];
  }
}
module.exports = ProductModel;
