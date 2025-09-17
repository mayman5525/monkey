const pool = require("./db");
class ProductModel {
  static async getProducts() {
    const res = await pool.query("SELECT * FROM products");
    return res.rows;
  }
  static async getProductsById(id) {
    const res = await pool.query(
      "SELECT * FROM products WHERE product_id = $1",
      [id]
    );
    return res.rows;
  }
  static async getProductsByCategory(category) {
    const res = await pool.query("SELECT * FROM products WHERE category = $1", [
      category,
    ]);
    return res.rows;
  }
  static async searchProducts(query) {
    const res = await pool.query(
      "SELECT * FROM products WHERE product_name ILIKE $1 OR product_description ILIKE $1",
      [`%${query}%`]
    );
    return res.rows;
  }
  static async createProduct(productData) {
    const { product_name, product_components, price, category } = productData;
    console.log("Inserting product:", {
      product_name,
      product_components,
      price,
      category,
    });
    const res = await pool.query(
      `INSERT INTO product (product_name, product_components, product_price, product_category, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    RETURNING *`,
      [product_name, product_components, price, category]
    );
    return res.rows[0];
  }
static async updateProduct(req, res) {
  try {
    const { id } = req.params;
    const updatedData = req.body;
    if (
      !updatedData.product_name ||
      !updatedData.price ||
      isNaN(updatedData.price) ||
      !updatedData.category
    ) {
      return res
        .status(400)
        .json({
          error: "Missing or invalid required fields: product_name, price, category",
        });
    }
    const updatedProduct = await ProductModel.updateProduct(id, updatedData);
    if (!updatedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.status(200).json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    if (error.code === "23503") {
      return res
        .status(400)
        .json({ error: "Invalid category: category does not exist" });
    }
    if (error.message === "Product not found") {
      return res.status(404).json({ error: "Product not found" });
    }
    res
      .status(500)
      .json({ error: "An error occurred while updating the product" });
  }
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
