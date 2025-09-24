const express = require("express");
const router = express.Router();
const authController = require("../controller/authController");
const userModule = require("../modules/userModule");
const { auth } = require("google-auth-library");

router.post("/signup", authController.signup);
router.post("/signin", authController.signin);
router.post("/request-reset-code", authController.requestPasswordResetCode);
router.post("/verify-reset-code", authController.verifyResetCode);
router.post("/reset-password-with-code", authController.resetPasswordWithCode);
router.get("/all", authController.get_users);
router.get("/user-details/:id",authController.get_user_details)

module.exports = router;
