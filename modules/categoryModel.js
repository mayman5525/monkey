const db = require("./db");
class categoryModel {
  static async getAllCategories() {
    const res = await db.query("SELECT * FROM category");
    return res.rows;
  }

  static async createCategory(categoryData) {
    const { category_name, description } = categoryData;
    const res = await db.query(
      `INSERT INTO category (category_name, description, created_at, updated_at)
            VALUES ($1, $2, NOW(), NOW())
            RETURNING *`,
      [category_name, description]
    );
    return res.rows[0];
  }

  static async deleteCategory(id) {
    const res = await db.query(
      "DELETE FROM category WHERE category_id = $1 RETURNING *",
      [id]
    );
    return res.rows[0];
  }

  static async updateCategory(id, updatedData) {
    const { category_name, description } = updatedData;
    const res = await db.query(
      `UPDATE category
            SET category_name = $1, description = $2, updated_at = NOW()
            WHERE category_id = $3
            RETURNING *`,
      [category_name, description, id]
    );
    return res.rows[0];
  }
}
module.exports = categoryModel;
