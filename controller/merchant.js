// controllers/merchant.controller.js
const MerchantService = require("../modules/merchant");
const {
  uploadFromBuffer,
  destroy,
  formatItemWithPhoto,
  processUploadedFile,
} = require("../utils/cloudinary");

// Helper function to format multiple items
const formatItemsWithPhotos = (items) => {
  if (!Array.isArray(items)) return items;
  return items.map((item) => formatItemWithPhoto(item));
};

exports.createMerchant = async (req, res) => {
  try {
    const merchantData = req.body;

    // === 1. UPLOAD PHOTO TO CLOUDINARY ===
    let photoUrl = null;
    let photoPublicId = null;

    if (req.file) {
      try {
        const result = await uploadFromBuffer(req.file.buffer, {
          folder: "ecommerce/merchants",
        });
        photoUrl = result.secure_url;
        photoPublicId = result.public_id;
        console.log("Uploaded to Cloudinary:", photoUrl);
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError);
        return res.status(500).json({ error: "Failed to upload image" });
      }
    }

    // === 2. VALIDATE REQUIRED FIELDS ===
    if (
      !merchantData.merchant_name ||
      !merchantData.merchant_price ||
      isNaN(merchantData.merchant_price)
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // === 3. CREATE MERCHANT ===
    const merchant = await MerchantService.createMerchant({
      merchant_name: merchantData.merchant_name,
      merchant_description: merchantData.merchant_description,
      merchant_price: parseFloat(merchantData.merchant_price),
      merchant_category: merchantData.merchant_category,
      merchant_photo: photoUrl,
      photo_public_id: photoPublicId,
    });

    // Remove photo_data, photo_mime_type, and photo_public_id from response
    const {
      photo_data,
      photo_mime_type,
      photo_public_id,
      ...merchantResponse
    } = merchant;

    res.status(201).json({
      success: true,
      message: "Merchant created successfully",
      merchant: merchantResponse,
    });
  } catch (error) {
    console.error("Error creating merchant:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAllMerchants = async (req, res) => {
  try {
    const merchants = await MerchantService.getAllMerchants();
    const formattedMerchants = formatItemsWithPhotos(merchants);
    res.status(200).json({ success: true, merchants: formattedMerchants });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getMerchantById = async (req, res) => {
  try {
    const merchant = await MerchantService.getMerchantById(req.params.id);
    const formattedMerchant = formatItemWithPhoto(merchant);
    res.status(200).json({ success: true, merchant: formattedMerchant });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
};

exports.updateMerchant = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Validate ID
    if (isNaN(id)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid merchant ID" });
    }

    // === 1. FETCH CURRENT MERCHANT (to get old public_id) ===
    const current = await MerchantService.getMerchantById(id);
    const oldPublicId = current.photo_public_id;

    // === 2. UPLOAD NEW PHOTO (if provided) ===
    let photoUrl = current.merchant_photo; // keep old
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
          folder: "ecommerce/merchants",
        });
        photoUrl = result.secure_url;
        photoPublicId = result.public_id;
        console.log("Uploaded new image:", result.secure_url);
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError);
        return res
          .status(500)
          .json({ success: false, error: "Failed to upload image" });
      }
    }

    // === 3. VALIDATE REQUIRED FIELDS ===
    if (
      data.merchant_price !== undefined &&
      (isNaN(data.merchant_price) || data.merchant_price < 0)
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid merchant_price. Must be a valid positive number.",
      });
    }

    // === 4. UPDATE MERCHANT ===
    const merchant = await MerchantService.updateMerchant(id, {
      merchant_name: data.merchant_name,
      merchant_description: data.merchant_description,
      merchant_price: data.merchant_price
        ? parseFloat(data.merchant_price)
        : undefined,
      merchant_category: data.merchant_category,
      merchant_photo: photoUrl,
      photo_public_id: photoPublicId,
    });

    // Remove photo_data, photo_mime_type, and photo_public_id from response
    const {
      photo_data,
      photo_mime_type,
      photo_public_id,
      ...merchantResponse
    } = merchant;

    res.status(200).json({
      success: true,
      message: "Merchant updated successfully",
      merchant: merchantResponse,
    });
  } catch (error) {
    console.error("Error updating merchant:", error);

    // Handle specific error cases
    if (error.message === "Merchant not found") {
      return res.status(404).json({ success: false, error: error.message });
    }

    res.status(500).json({
      success: false,
      error: "An error occurred while updating the merchant",
      details: error.message,
    });
  }
};

exports.updateMerchantPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No photo provided" });
    }

    const { photo_data, photo_mime_type } = processUploadedFile(req.file);
    const merchant = await MerchantService.updateMerchantPhoto(
      req.params.id,
      photo_data,
      photo_mime_type
    );
    const formattedMerchant = formatItemWithPhoto(merchant);
    res.status(200).json({ success: true, merchant: formattedMerchant });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.deleteMerchant = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (isNaN(id)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid merchant ID" });
    }

    const deleted = await MerchantService.deleteMerchant(id);
    res.status(200).json({
      success: true,
      message: `Merchant with ID ${id} deleted successfully`,
      deleted,
    });
  } catch (error) {
    console.error("Error deleting merchant:", error);

    // Handle specific error cases
    if (error.message === "Merchant not found") {
      return res.status(404).json({ success: false, error: error.message });
    }

    // Handle foreign key constraint errors (shouldn't happen with cascade, but just in case)
    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        error:
          "Cannot delete merchant: it is still referenced by other records",
      });
    }

    res.status(500).json({
      success: false,
      error: "An error occurred while deleting the merchant",
      details: error.message,
    });
  }
};
