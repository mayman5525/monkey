// controllers/merchant.controller.js
const MerchantService = require("../modules/merchant");
const {
  processUploadedFile,
  formatItemsWithPhotos,
  formatItemWithPhoto,
} = require("../utils/photoHelper");

exports.createMerchant = async (req, res) => {
  try {
    console.log("📝 Request body:", req.body);
    console.log("📸 Request file:", req.file); // This should NOT be undefined!
    console.log("🔍 File exists?", !!req.file);

    const merchantData = req.body;

    // Handle photo upload if file is present
    if (req.file) {
      console.log("✅ Processing file:", req.file.originalname);
      try {
        const photoDbData = processUploadedFile(req.file);
        console.log("✅ Photo processed, size:", photoDbData.photo_data.length);
        merchantData.photo_data = photoDbData.photo_data;
        merchantData.photo_mime_type = photoDbData.photo_mime_type;
      } catch (photoError) {
        console.error("❌ Photo processing error:", photoError.message);
        return res
          .status(400)
          .json({ success: false, error: photoError.message });
      }
    } else {
      console.log("⚠️ No file received in req.file");
    }

    const merchant = await MerchantService.createMerchant(merchantData);
    const formattedMerchant = formatItemWithPhoto(merchant);
    res.status(201).json({ success: true, merchant: formattedMerchant });
  } catch (error) {
    console.error("Error creating merchant:", error.message);
    res.status(400).json({ success: false, error: error.message });
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
    const merchantData = req.body;

    // Handle photo upload if file is present
    if (req.file) {
      try {
        const photoDbData = processUploadedFile(req.file);
        merchantData.photo_data = photoDbData.photo_data;
        merchantData.photo_mime_type = photoDbData.photo_mime_type;
      } catch (photoError) {
        console.error("Photo processing error:", photoError.message);
        return res
          .status(400)
          .json({ success: false, error: photoError.message });
      }
    }

    const merchant = await MerchantService.updateMerchant(
      req.params.id,
      merchantData
    );
    const formattedMerchant = formatItemWithPhoto(merchant);
    res.status(200).json({ success: true, merchant: formattedMerchant });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
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
