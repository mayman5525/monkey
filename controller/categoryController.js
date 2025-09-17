const categoryModel = require("../modules/");
class categoryController {
  static async getAllCategories(req, res) {
    try {
      const categories = await categoryModel.getAllCategories();
      res.status(200).json({
        message: "All categories retrieved successfully",
        categories: categories,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "An error occurred while retrieving categories" });
    }
  }

  static async createCategory(req, res) {
    try {
      const categoryData = req.body;
      const newCategory = await categoryModel.createCategory(categoryData);
      res.status(201).json({
        message: "Category created successfully",
        category: newCategory,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "An error occurred while creating the category" });
    }
  }
  static async deleteCategory(req, res) {
    try {
      const { id } = req.params;
      const deletedCategory = await categoryModel.deleteCategory(id);
      res.status(200).json({
        message: `Category with ID ${id} deleted successfully`,
        category: deletedCategory,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "An error occurred while deleting the category" });
    }
  }
  static async updateCategory(req, res) {
    try {
      const { id } = req.params;
      const updatedData = req.body;
      const updatedCategory = await categoryModel.updateCategory(
        id,
        updatedData
      );
      res.status(200).json({
        message: `Category with ID ${id} updated successfully`,
        category: updatedCategory,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "An error occurred while updating the category" });
    }
  }
}
module.exports = {categoryController};
