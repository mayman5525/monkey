// controllers/merchant.controller.js
const MerchantService = require("../modules/merchant");

exports.createMerchant = async (req, res) => {
  try {
    const merchant = await MerchantService.createMerchant(req.body);
    res.status(201).json({ success: true, merchant });
  } catch (error) {
    console.error("Error creating merchant:", error.message);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getAllMerchants = async (req, res) => {
  try {
    const merchants = await MerchantService.getAllMerchants();
    res.status(200).json({ success: true, merchants });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getMerchantById = async (req, res) => {
  try {
    const merchant = await MerchantService.getMerchantById(req.params.id);
    res.status(200).json({ success: true, merchant });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
};

exports.updateMerchant = async (req, res) => {
  try {
    const merchant = await MerchantService.updateMerchant(req.params.id, req.body);
    res.status(200).json({ success: true, merchant });
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
