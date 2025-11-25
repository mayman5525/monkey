const DiscountService = require("../modules/discount");

class DiscountController {
    /**
     * Create a new discount (inactive by default)
     * POST /api/discounts
     */
    static async createDiscount(req, res) {
        try {
            const discountData = req.body;
            const newDiscount = await DiscountService.createDiscount(discountData);

            res.status(201).json({
                message: "Discount created successfully",
                discount: newDiscount,
            });
        } catch (error) {
            console.error("Error creating discount:", error);
            res.status(500).json({
                error: "An error occurred while creating the discount",
                details: error.message,
            });
        }
    }

    /**
     * Get the active discount (only one active discount in the system)
     * GET /api/discounts/active
     */
    static async getActiveDiscount(req, res) {
        try {
            const activeDiscount = await DiscountService.getActiveDiscount();

            if (!activeDiscount) {
                return res.status(404).json({
                    message: "No active discount found",
                });
            }

            res.status(200).json({
                message: "Active discount retrieved successfully",
                discount: activeDiscount,
            });
        } catch (error) {
            console.error("Error getting active discount:", error);
            res.status(500).json({
                error: "An error occurred while getting the active discount",
                details: error.message,
            });
        }
    }

    /**
     * Activate a specific discount (deactivates all others)
     * PUT /api/discounts/:id/activate
     */
    static async activateDiscount(req, res) {
        try {
            const { id } = req.params;

            // Validate ID
            if (isNaN(id)) {
                return res.status(400).json({ error: "Invalid discount ID" });
            }

            const activatedDiscount = await DiscountService.activateDiscount(
                parseInt(id)
            );

            res.status(200).json({
                message: "Discount activated successfully. All other discounts have been deactivated.",
                discount: activatedDiscount,
            });
        } catch (error) {
            console.error("Error activating discount:", error);

            if (error.message === "Discount not found") {
                return res.status(404).json({ error: error.message });
            }

            res.status(500).json({
                error: "An error occurred while activating the discount",
                details: error.message,
            });
        }
    }

    /**
     * Get all discounts (both active and inactive)
     * GET /api/discounts
     */
    static async getAllDiscounts(req, res) {
        try {
            const discounts = await DiscountService.getAllDiscounts();

            res.status(200).json({
                message: "All discounts retrieved successfully",
                count: discounts.length,
                discounts: discounts,
            });
        } catch (error) {
            console.error("Error getting all discounts:", error);
            res.status(500).json({
                error: "An error occurred while retrieving discounts",
                details: error.message,
            });
        }
    }

    /**
     * Get discount by ID
     * GET /api/discounts/:id
     */
    static async getDiscountById(req, res) {
        try {
            const { id } = req.params;

            // Validate ID
            if (isNaN(id)) {
                return res.status(400).json({ error: "Invalid discount ID" });
            }

            const discount = await DiscountService.getDiscountById(parseInt(id));

            res.status(200).json({
                message: `Discount with ID ${id} retrieved successfully`,
                discount: discount,
            });
        } catch (error) {
            console.error("Error getting discount by ID:", error);

            if (error.message === "Discount not found") {
                return res.status(404).json({ error: error.message });
            }

            res.status(500).json({
                error: "An error occurred while retrieving the discount",
                details: error.message,
            });
        }
    }

    /**
     * Delete a discount
     * DELETE /api/discounts/:id
     * Note: Cannot delete active discount - must activate another first
     */
    static async deleteDiscount(req, res) {
        try {
            const { id } = req.params;

            // Validate ID
            if (isNaN(id)) {
                return res.status(400).json({ error: "Invalid discount ID" });
            }

            const deletedDiscount = await DiscountService.deleteDiscount(
                parseInt(id)
            );

            res.status(200).json({
                message: `Discount with ID ${id} deleted successfully`,
                discount: deletedDiscount,
            });
        } catch (error) {
            console.error("Error deleting discount:", error);

            if (error.message === "Discount not found") {
                return res.status(404).json({ error: error.message });
            }

            if (
                error.message.includes("Cannot delete an active discount")
            ) {
                return res.status(400).json({ error: error.message });
            }

            res.status(500).json({
                error: "An error occurred while deleting the discount",
                details: error.message,
            });
        }
    }

    /**
     * Update a discount
     * PUT /api/discounts/:id
     * Note: Cannot update active discount
     */
    static async updateDiscount(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            // Validate ID
            if (isNaN(id)) {
                return res.status(400).json({ error: "Invalid discount ID" });
            }

            const updatedDiscount = await DiscountService.updateDiscount(
                parseInt(id),
                updateData
            );

            res.status(200).json({
                message: "Discount updated successfully",
                discount: updatedDiscount,
            });
        } catch (error) {
            console.error("Error updating discount:", error);

            if (error.message === "Discount not found") {
                return res.status(404).json({ error: error.message });
            }

            if (
                error.message.includes("Cannot update an active discount") ||
                error.message.includes("No fields to update") ||
                error.message.includes("discount_value must be between")
            ) {
                return res.status(400).json({ error: error.message });
            }

            res.status(500).json({
                error: "An error occurred while updating the discount",
                details: error.message,
            });
        }
    }
}

module.exports = DiscountController;
