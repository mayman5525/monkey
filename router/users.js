const express = require("express");
const router = express.Router();
const authController = require("../controller/authController");
const userModule = require("../modules/userModule");

router.post("/signup", authController.signup);
router.post("/signin", authController.signin);
router.post("/request-reset-code", authController.requestPasswordResetCode);
router.post("/verify-reset-code", authController.verifyResetCode);
router.post("/reset-password-with-code", authController.resetPasswordWithCode);
router.get("/all", userModule.getAllUsers);

module.exports = router;
