// routes/merchant.routes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const merchantController = require("../controller/merchant");

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Create merchant with photo
router.post(
  "/",
  upload.single("merchant_photo"),
  merchantController.createMerchant
);

// Get all merchants
router.get("/", merchantController.getAllMerchants);

// Get merchant by ID
router.get("/:id", merchantController.getMerchantById);

// Update merchant with photo
router.put(
  "/:id",
  upload.single("merchant_photo"),
  merchantController.updateMerchant
);

// Update only merchant photo
router.patch(
  "/:id/photo",
  upload.single("merchant_photo"),
  merchantController.updateMerchantPhoto
);

// Delete merchant
router.delete("/:id", merchantController.deleteMerchant);

module.exports = router;
