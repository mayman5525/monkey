const express = require("express");
const router = express.Router();
const DiscountController = require("../controller/discount");

/**
 * @route   POST /api/discounts
 * @desc    Create a new discount (inactive by default)
 * @access  Admin (add auth middleware if needed)
 * @body    { user_id, discount_value, discount_code?, discount_description?, expires_at? }
 */
router.post("/", DiscountController.createDiscount);

/**
 * @route   GET /api/discounts
 * @desc    Get all discounts (both active and inactive)
 * @access  Admin
 */
router.get("/", DiscountController.getAllDiscounts);

/**
 * @route   GET /api/discounts/active
 * @desc    Get the currently active discount
 * @access  Public or Admin
 */
router.get("/active", DiscountController.getActiveDiscount);

/**
 * @route   GET /api/discounts/:id
 * @desc    Get discount by ID
 * @access  Admin
 */
router.get("/:id", DiscountController.getDiscountById);

/**
 * @route   PUT /api/discounts/:id/activate
 * @desc    Activate a discount (deactivates all others)
 * @access  Admin
 */
router.put("/:id/activate", DiscountController.activateDiscount);

/**
 * @route   PUT /api/discounts/:id
 * @desc    Update a discount (cannot update if active)
 * @access  Admin
 */
router.put("/:id", DiscountController.updateDiscount);

/**
 * @route   DELETE /api/discounts/:id
 * @desc    Delete a discount (cannot delete if active)
 * @access  Admin
 */
router.delete("/:id", DiscountController.deleteDiscount);

module.exports = router;
