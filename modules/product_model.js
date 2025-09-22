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
  static async createProduct(productData) {
    const {
      product_name,
      product_components,
      price,
      category,
      product_photo,
      is_featured,
    } = productData;
    const res = await pool.query(
      `INSERT INTO product (product_name, product_components, product_price, product_category, product_photo, is_featured, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING *`,
      [
        product_name,
        product_components,
        price,
        category,
        product_photo,
        is_featured || false,
      ]
    );
    return res.rows[0];
  }

  static async updateProduct(id, updatedData) {
    const {
      product_name,
      product_components,
      price,
      category,
      product_photo,
      is_featured,
    } = updatedData;
    const res = await pool.query(
      `UPDATE product 
     SET product_name = $1, product_components = $2, product_price = $3, product_category = $4, product_photo = $5, is_featured = $6, updated_at = NOW()
     WHERE product_id = $7
     RETURNING *`,
      [
        product_name,
        product_components,
        price,
        category,
        product_photo,
        is_featured || false,
        id,
      ]
    );
    if (res.rows.length === 0) {
      throw new Error("Product not found");
    }
    return res.rows[0];
  }
  static async deleteProduct(id) {
    console.log("Deleting product ID:", id);
    const res = await pool.query(
      "DELETE FROM product WHERE product_id = $1 RETURNING *",
      [id]
    );
    if (res.rows.length === 0) {
      throw new Error("Product not found");
    }
    return res.rows[0];
  }
}
module.exports = ProductModel;
