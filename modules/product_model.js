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

  static async getProductsByCategoryId(categoryId) {
    const res = await pool.query(
      "SELECT * FROM product WHERE category_id = $1 ORDER BY created_at DESC",
      [categoryId]
    );
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
  static async createProduct({
    product_name,
    product_components,
    price,
    category_id,
    category_name,
    product_photo,
    is_featured,
    photo_public_id,
  }) {
    const query = `
    INSERT INTO product (product_name, product_components, product_price, category_id, product_category, product_photo, is_featured, photo_public_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
    const values = [
      product_name,
      product_components,
      price,
      category_id,
      category_name,
      product_photo,
      is_featured,
      photo_public_id,
    ];
    const res = await pool.query(query, values);
    return res.rows[0];
  }
  // modules/product_model.js
  // modules/product_model.js
  static async updateProduct(
    id,
    {
      product_name,
      product_components,
      price,
      category_id,
      category_name,
      product_photo,
      is_featured,
      photo_public_id,
    }
  ) {
    // FIXED: Corrected parameter order to match SQL
    const query = `
    UPDATE product
    SET 
      product_name = $1, 
      product_components = $2, 
      product_price = $3, 
      category_id = $4,
      product_category = $5,
      product_photo = $6, 
      is_featured = $7,
      photo_public_id = $8,
      updated_at = NOW()
    WHERE product_id = $9
    RETURNING *
  `;

    const values = [
      product_name,
      product_components,
      price,
      category_id, // $4
      category_name, // $5 - This goes to product_category column
      product_photo, // $6
      is_featured, // $7
      photo_public_id, // $8
      id, // $9
    ];

    try {
      const res = await pool.query(query, values);

      if (res.rows.length === 0) {
        throw new Error("Product not found");
      }

      return res.rows[0];
    } catch (error) {
      console.error("Database update error:", error);
      throw error;
    }
  }
  static async updateProductCleaner(
    id,
    {
      product_name,
      product_components,
      price,
      category_name, // ← ONLY receives category name
      product_photo,
      is_featured,
      photo_public_id,
    }
  ) {
    try {
      // Single query to get category_id and update product
      const query = `
      WITH category_lookup AS (
        SELECT category_id 
        FROM category 
        WHERE category_name = $4
      )
      UPDATE product
      SET 
        product_name = $1, 
        product_components = $2, 
        product_price = $3, 
        category_id = (SELECT category_id FROM category_lookup),
        product_category = $4,
        product_photo = $5, 
        is_featured = $6,
        photo_public_id = $7,
        updated_at = NOW()
      WHERE product_id = $8
      RETURNING *
    `;

      const values = [
        product_name,
        product_components,
        price,
        category_name, // $4
        product_photo, // $5
        is_featured, // $6
        photo_public_id, // $7
        id, // $8
      ];

      const res = await pool.query(query, values);

      if (res.rows.length === 0) {
        throw new Error("Product not found or invalid category");
      }

      return res.rows[0];
    } catch (error) {
      console.error("Database update error:", error);

      // Check if error is due to invalid category
      if (error.message.includes("null value")) {
        throw new Error(`Category '${category_name}' not found`);
      }

      throw error;
    }
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
