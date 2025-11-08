const express = require("express");
const productController = require("../controller/productController");
const router = express.Router();
const multer = require("multer");

// Configure multer for memory storage (no more Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Get all products
router.get("/", productController.getAllProducts);

// Get product by ID
router.get("/:id", productController.getProductById);

// Search products
router.get("/search", productController.searchProducts);

// Get products by category ID
router.get(
  "/category-id/:categoryId",
  productController.getProductsByCategoryId
);

// Create product with photo (stored in database)
router.post(
  "/",
  upload.single("product_photo"),
  productController.createProduct
);

// Update product with photo (stored in database)
router.put(
  "/:id",
  upload.single("product_photo"),
  productController.updateProduct
);

// Delete product
router.delete("/:id", productController.deleteProduct);

module.exports = router;
