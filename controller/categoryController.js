const categoryModel = require("../modules/categoryModel");
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
      console.error("Error creating category:", error);
      res.status(500).json({
        error: "An error occurred while creating the category",
        details: error.message,
      });
    }
  }
  static async deleteCategory(req, res) {
    try {
      const { id } = req.params;
      
      // Validate ID
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid category ID" });
      }

      const deletedCategory = await categoryModel.deleteCategory(id);
      res.status(200).json({
        message: `Category with ID ${id} deleted successfully`,
        category: deletedCategory,
      });
    } catch (error) {
      console.error("Error deleting category:", error);
      
      // Handle specific error cases
      if (error.message === "Category not found") {
        return res.status(404).json({ error: error.message });
      }
      
      // Handle foreign key constraint errors (shouldn't happen with cascade, but just in case)
      if (error.code === "23503") {
        return res.status(400).json({ 
          error: "Cannot delete category: it is still referenced by other records" 
        });
      }
      
      res.status(500).json({ 
        error: "An error occurred while deleting the category",
        details: error.message 
      });
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
module.exports = categoryController;
