// routes/merchant.routes.js
const express = require("express");
const router = express.Router();
const merchantController = require("../controller/merchant");

router.post("/", merchantController.createMerchant);
router.get("/", merchantController.getAllMerchants);
router.get("/:id", merchantController.getMerchantById);
router.put("/:id", merchantController.updateMerchant);
router.delete("/:id", merchantController.deleteMerchant);

module.exports = router;
