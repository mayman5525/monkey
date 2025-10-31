// controllers/merchant.controller.js
const MerchantService = require("../modules/merchant");
const { uploadFromBuffer, destroy } = require("../utils/cloudinary");


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
    if (!merchantData.merchant_name || !merchantData.merchant_price || isNaN(merchantData.merchant_price)) {
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

    res.status(201).json({ success: true, merchant });
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

    // === 1. GET OLD PUBLIC_ID ===
    const current = await MerchantService.getMerchantById(id);
    const oldPublicId = current.photo_public_id;

    // === 2. UPLOAD NEW PHOTO (if provided) ===
    let photoUrl = current.merchant_photo;
    let photoPublicId = oldPublicId;

    if (req.file) {
      try {
        if (oldPublicId) {
          await destroy(oldPublicId);
          console.log("Deleted old image:", oldPublicId);
        }
        const result = await uploadFromBuffer(req.file.buffer, {
          folder: "ecommerce/merchants",
        });
        photoUrl = result.secure_url;
        photoPublicId = result.public_id;
      } catch (err) {
        return res.status(500).json({ error: "Image upload failed" });
      }
    }

    // === 3. UPDATE ===
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

    res.json({ success: true, merchant });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const deleted = await MerchantService.deleteMerchant(req.params.id);
    res.status(200).json({ success: true, deleted });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
};
