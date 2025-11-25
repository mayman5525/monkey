const productModel = require("../modules/product_model");
const pool = require("../modules/db");
const {
  uploadFromBuffer,
  destroy,
  formatItemWithPhoto,
} = require("../utils/cloudinary");

// Helper function to format multiple items
const formatItemsWithPhotos = (items) => {
  if (!Array.isArray(items)) return items;
  return items.map((item) => formatItemWithPhoto(item));
};

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

  static async getProductsByCategoryId(req, res) {
    try {
      const { categoryId } = req.params;

      // Validate categoryId
      if (isNaN(categoryId)) {
        return res.status(400).json({ error: "Invalid category ID" });
      }

      const products = await productModel.getProductsByCategoryId(categoryId);
      const formattedProducts = formatItemsWithPhotos(products);
      res.status(200).json({
        message: `Products in category ID ${categoryId} retrieved successfully`,
        products: formattedProducts,
      });
    } catch (error) {
      console.error("Error retrieving products by category ID:", error);
      res.status(500).json({
        error: "An error occurred while retrieving products by category ID",
      });
    }
  }

  // controller
  static async createProduct(req, res) {
    try {
      const productData = req.body;

      // 1. UPLOAD PHOTO
      let photoUrl = null;
      let photoPublicId = null;
      if (req.file) {
        const result = await uploadFromBuffer(req.file.buffer, {
          folder: "ecommerce/products",
        });
        photoUrl = result.secure_url;
        photoPublicId = result.public_id;
      }

      // 2. VALIDATE
      if (
        !productData.product_name ||
        !productData.price ||
        isNaN(productData.price) ||
        !productData.category
      ) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // 3. GET category_id
      const categoryResult = await pool.query(
        `SELECT category_id FROM category WHERE category_name = $1`,
        [productData.category]
      );
      if (categoryResult.rows.length === 0) {
        return res
          .status(400)
          .json({ error: `Category '${productData.category}' not found` });
      }
      const categoryId = categoryResult.rows[0].category_id;
      const categoryName = productData.category; // Store category name

      // 4. CREATE
      const newProduct = await productModel.createProduct({
        product_name: productData.product_name,
        product_components: productData.product_components || null,
        price: parseFloat(productData.price),
        category_id: categoryId,
        category_name: categoryName, // Pass category name to set product_category
        product_photo: photoUrl,
        photo_public_id: photoPublicId,
        is_featured:
          productData.is_featured === true ||
          productData.is_featured === "true",
      });

      // Remove photo_data, photo_mime_type, and photo_public_id from response
      const {
        photo_data,
        photo_mime_type,
        photo_public_id,
        ...productResponse
      } = newProduct;

      res.status(201).json({
        message: "Product created",
        product: productResponse,
      });
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
  static async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const updatedData = req.body;

      // === 1. VALIDATE INPUT FIRST ===
      if (
        !updatedData.product_name ||
        !updatedData.price ||
        isNaN(updatedData.price) ||
        !updatedData.category
      ) {
        return res.status(400).json({
          error: "Missing required fields: product_name, price, category",
        });
      }

      // === 2. FETCH CURRENT PRODUCT ===
      const currentProduct = await productModel.getProductsById(id);
      if (!currentProduct || currentProduct.length === 0) {
        return res.status(404).json({ error: "Product not found" });
      }

      const old = currentProduct[0];
      let photoUrl = old.product_photo;
      let photoPublicId = old.photo_public_id;

      // === 3. GET category_id FROM category name ===
      console.log("Looking up category:", updatedData.category);

      const categoryQuery = await pool.query(
        `SELECT category_id FROM category WHERE category_name = $1`,
        [updatedData.category.trim()]
      );

      if (categoryQuery.rows.length === 0) {
        return res.status(400).json({
          error: `Category '${updatedData.category}' not found`,
        });
      }

      const categoryId = categoryQuery.rows[0].category_id;
      console.log("Category ID found:", categoryId);

      // === 4. HANDLE IMAGE UPLOAD ===
      if (req.file) {
        try {
          // Delete old image
          if (photoPublicId) {
            await destroy(photoPublicId);
          }

          // Upload new image
          const uploaded = await uploadFromBuffer(req.file.buffer, {
            folder: "ecommerce/products",
          });

          photoUrl = uploaded.secure_url;
          photoPublicId = uploaded.public_id;
        } catch (imgErr) {
          console.error("Image upload failed:", imgErr);
          return res.status(500).json({ error: "Failed to upload image" });
        }
      }

      // === 5. CLEAN OPTIONAL FIELDS ===
      const isFeatured =
        updatedData.is_featured === true || updatedData.is_featured === "true";

      // === 6. UPDATE IN DATABASE (Only pass category name) ===
      const updatedProduct = await productModel.updateProduct(id, {
        product_name: updatedData.product_name,
        product_components: updatedData.product_components || null,
        price: parseFloat(updatedData.price),
        category_name: updatedData.category.trim(), // ← ONLY category name
        product_photo: photoUrl,
        photo_public_id: photoPublicId,
        is_featured: isFeatured,
      });

      // === 7. CLEAN RESPONSE ===
      const {
        photo_data,
        photo_mime_type,
        photo_public_id: _,
        ...cleanedProduct
      } = updatedProduct;

      res.status(200).json({
        message: "Product updated successfully",
        product: cleanedProduct,
      });
    } catch (error) {
      console.error("Error updating product:", error);

      if (error.code === "ECONNRESET") {
        return res.status(503).json({
          error: "Database connection lost. Please try again.",
        });
      }

      if (error.message === "Product not found") {
        return res.status(404).json({ error: "Product not found" });
      }

      res.status(500).json({
        error: "Server error",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  static async deleteProduct(req, res) {
    try {
      const { id } = req.params;

      // Validate ID
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid product ID" });
      }

      const deletedProduct = await productModel.deleteProduct(id);
      res.status(200).json({
        message: `Product with ID ${id} deleted successfully`,
        product: deletedProduct,
      });
    } catch (error) {
      console.error("Error deleting product:", error);

      // Handle specific error cases
      if (error.message === "Product not found") {
        return res.status(404).json({ error: error.message });
      }

      // Handle foreign key constraint errors (shouldn't happen with cascade, but just in case)
      if (error.code === "23503") {
        return res.status(400).json({
          error:
            "Cannot delete product: it is still referenced by other records",
        });
      }

      res.status(500).json({
        error: "An error occurred while deleting the product",
        details: error.message,
      });
    }
  }
}

module.exports = productController;
