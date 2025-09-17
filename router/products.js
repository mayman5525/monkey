const express = require("express");
const productController = require("../controller/productController");
const router = express.Router();

router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.get("/search", productController.searchProducts);
router.get("/category/:category", productController.gerProductByCategory);
router.post("/", productController.createProduct);
router.put("/:id", productController.updateProduct);
router.delete("/:id", productController.deleteProduct);

module.exports = router;
