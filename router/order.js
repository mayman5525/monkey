const express = require("express");
const router = express.Router();
const OrderController = require("../controller/orderController");
const adminMiddleware = require("../utils/admin"); // Middleware for admin access

// Checkout order
router.post("/checkout", OrderController.checkoutOrder);

// Get order details by order_id (admin)
router.get("/:orderId/details", adminMiddleware, OrderController.getOrderDetails);

// Get order details by order_code (admin)
router.get("/code/:orderCode/details", adminMiddleware, OrderController.getOrderDetailsByCode);

// Get order elements by order_id
router.get("/:orderId", OrderController.getOrder);

// Get order elements by order_code
router.get("/code/:orderCode", OrderController.getOrderByCode);

// Search orders by partial or full order_code
router.get("/search", OrderController.searchOrdersByCode);

// Get all orders (admin)
router.get("/", adminMiddleware, OrderController.getAllOrdersForAdmin);

// Get all orders for authenticated user
router.get("/user", OrderController.getAllOrdersForUser);

module.exports = router;