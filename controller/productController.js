const productModel = require("../modules/product_model");
const {
  processUploadedFile,
  formatItemsWithPhotos,
  formatItemWithPhoto,
} = require("../utils/photoHelper");

class productController {
  static async getAllProducts(req, res) {
    try {
      const Products = await productModel.getProducts();
      const formattedProducts = formatItemsWithPhotos(Products);
      res.status(200).json({
        message: "All products retrieved successfully",
        products: formattedProducts,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "An error occurred while retrieving products" });
    }
  }

  static async getProductById(req, res) {
    try {
      const { id } = req.params;
      const product = await productModel.getProductsById(id);
      if (!product || product.length === 0) {
        return res.status(404).json({ error: "Product not found" });
      }
      const formattedProduct = formatItemWithPhoto(product[0]);
      res.status(200).json({
        message: `Product with ID ${id} retrieved successfully`,
        product: formattedProduct,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "An error occurred while retrieving the product" });
    }
  }

  static async searchProducts(req, res) {
    try {
      const { query } = req.query;
      const products = await productModel.searchProducts(query);
      const formattedProducts = formatItemsWithPhotos(products);
      res.status(200).json({
        message: `Products matching query "${query}" retrieved successfully`,
        products: formattedProducts,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "An error occurred while searching for products" });
    }
  }

  static async gerProductByCategory(req, res) {
    try {
      const { category } = req.params;
      const products = await productModel.getProductsByCategory(category);
      const formattedProducts = formatItemsWithPhotos(products);
      res.status(200).json({
        message: `Products in category "${category}" retrieved successfully`,
        products: formattedProducts,
      });
    } catch (error) {
      res.status(500).json({
        error: "An error occurred while retrieving products by category",
      });
    }
  }

  static async createProduct(req, res) {
    try {
      const productData = req.body;

      // Handle photo upload - store directly in database
      if (req.file) {
        try {
          const photoDbData = processUploadedFile(req.file);
          productData.photo_data = photoDbData.photo_data;
          productData.photo_mime_type = photoDbData.photo_mime_type;
        } catch (photoError) {
          return res.status(400).json({
            error: `Photo upload failed: ${photoError.message}`,
          });
        }
      }

      if (
        !productData.product_name ||
        !productData.price ||
        isNaN(productData.price) ||
        !productData.category
      ) {
        return res.status(400).json({
          error:
            "Missing or invalid required fields: product_name, price, category",
        });
      }

      // Ensure is_featured is a boolean
      productData.is_featured =
        productData.is_featured === true || productData.is_featured === "true";

      const newProduct = await productModel.createProduct(productData);
      const formattedProduct = formatItemWithPhoto(newProduct);
      res.status(201).json({
        message: "Product created successfully",
        product: formattedProduct,
      });
    } catch (error) {
      console.error("Error creating product:", error);
      if (error.code === "23503") {
        return res
          .status(400)
          .json({ error: "Invalid category: category does not exist" });
      }
      if (error.code === "42P01") {
        return res.status(500).json({ error: "Database table does not exist" });
      }
      if (error.code === "42703") {
        return res
          .status(500)
          .json({ error: "Database column does not exist" });
      }
      res
        .status(500)
        .json({ error: "An error occurred while creating the product" });
    }
  }

  static async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const updatedData = req.body;

      // Handle photo upload - store directly in database
      if (req.file) {
        try {
          const photoDbData = processUploadedFile(req.file);
          updatedData.photo_data = photoDbData.photo_data;
          updatedData.photo_mime_type = photoDbData.photo_mime_type;
        } catch (photoError) {
          return res.status(400).json({
            error: `Photo upload failed: ${photoError.message}`,
          });
        }
      }

      if (
        !updatedData.product_name ||
        !updatedData.price ||
        isNaN(updatedData.price) ||
        !updatedData.category
      ) {
        return res.status(400).json({
          error:
            "Missing or invalid required fields: product_name, price, category",
        });
      }

      const updatedProduct = await productModel.updateProduct(id, updatedData);
      if (!updatedProduct) {
        return res.status(404).json({ error: "Product not found" });
      }

      const formattedProduct = formatItemWithPhoto(updatedProduct);
      res.status(200).json({
        message: "Product updated successfully",
        product: formattedProduct,
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

  static async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      const deletedProduct = await productModel.deleteProduct(id);
      res.status(200).json({
        message: `Product with ID ${id} deleted successfully`,
        product: deletedProduct,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "An error occurred while deleting the product" });
    }
  }
}

module.exports = productController;
