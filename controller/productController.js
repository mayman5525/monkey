const productModel = require("../modules/product_model");
const pool = require("../modules/db");
const { uploadFromBuffer, destroy } = require("../utils/cloudinary");
const { formatItemWithPhoto } = require("../utils/cloudinary"); // you can keep this for URL → dataURL if you still need it
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

      // 4. CREATE
      const newProduct = await productModel.createProduct({
        product_name: productData.product_name,
        product_components: productData.product_components || null,
        price: parseFloat(productData.price),
        category_id: categoryId, // ← FIXED
        product_photo: photoUrl,
        photo_public_id: photoPublicId,
        is_featured:
          productData.is_featured === true ||
          productData.is_featured === "true",
      });

      res.status(201).json({
        message: "Product created",
        product: newProduct,
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

      // === 1. FETCH CURRENT PRODUCT (to get old public_id) ===
      const currentProduct = await productModel.getProductsById(id);
      if (!currentProduct || currentProduct.length === 0) {
        return res.status(404).json({ error: "Product not found" });
      }
      const oldPublicId = currentProduct[0].photo_public_id;

      // === 2. UPLOAD NEW PHOTO (if provided) ===
      let photoUrl = currentProduct[0].product_photo; // keep old
      let photoPublicId = oldPublicId;

      if (req.file) {
        try {
          // Delete old image from Cloudinary
          if (oldPublicId) {
            await destroy(oldPublicId);
            console.log("Deleted old image:", oldPublicId);
          }

          // Upload new image
          const result = await uploadFromBuffer(req.file.buffer, {
            folder: "ecommerce/products",
          });
          photoUrl = result.secure_url;
          photoPublicId = result.public_id;
          console.log("Uploaded new image:", result.secure_url);
        } catch (uploadError) {
          console.error("Cloudinary upload failed:", uploadError);
          return res.status(500).json({ error: "Failed to upload image" });
        }
      }

      // === 3. VALIDATE REQUIRED FIELDS ===
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

      // === 4. CONVERT CATEGORY NAME → ID ===
      const categoryResult = await pool.query(
        `SELECT category_id FROM category WHERE category_name = $1`,
        [updatedData.category]
      );

      if (categoryResult.rows.length === 0) {
        return res.status(400).json({
          error: `Invalid category: '${updatedData.category}' does not exist`,
        });
      }
      updatedData.category = categoryResult.rows[0].category_id;

      // === 5. SET OPTIONAL FIELDS ===
      updatedData.is_featured =
        updatedData.is_featured === true || updatedData.is_featured === "true";

      // === 6. CALL MODEL WITH NEW VALUES ===
      const updatedProduct = await productModel.updateProduct(id, {
        product_name: updatedData.product_name,
        product_components: updatedData.product_components,
        price: updatedData.price,
        category: updatedData.category,
        product_photo: photoUrl,
        is_featured: updatedData.is_featured,
        photo_public_id: photoPublicId,
      });

      const formattedProduct = formatItemWithPhoto(updatedProduct);
      res.status(200).json({
        message: "Product updated successfully",
        product: formattedProduct,
      });
    } catch (error) {
      console.error("Error updating product:", error);
      if (error.code === "23503") {
        return res.status(400).json({ error: "Invalid category" });
      }
      res.status(500).json({ error: "An error occurred while updating" });
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
