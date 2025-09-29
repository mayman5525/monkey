
const OrderModel = require("../modules/order");

class OrderController {
  // Checkout order
  static async checkoutOrder(req, res) {
    try {
      const { user_id, items } = req.body;
      if (!user_id || !items || !Array.isArray(items)) {
        return res
          .status(400)
          .json({
            error: "Invalid input: user_id and items array are required",
          });
      }
      const order = await OrderModel.checkoutOrder({ user_id, items });
      res.status(201).json({
        message: "Checkout successful",
        order_id: order.order_id,
        order_code: order.order_code,
        total_price: order.total_price,
      });
    } catch (error) {
      console.error("Error in checkoutOrder:", error.message);
      res.status(400).json({ error: error.message });
    }
  }

  // Get comprehensive order details by order_id (admin dashboard)
  static async getOrderDetails(req, res) {
    try {
      const orderId = req.params.orderId;
      const details = await OrderModel.getOrderDetails(orderId);
      res.status(200).json(details);
    } catch (error) {
      console.error("Error in getOrderDetails:", error.message);
      res.status(404).json({ error: error.message });
    }
  }

  // Get comprehensive order details by order_code (admin dashboard)
  static async getOrderDetailsByCode(req, res) {
    try {
      const orderCode = req.params.orderCode;
      const details = await OrderModel.getOrderDetailsByCode(orderCode);
      res.status(200).json(details);
    } catch (error) {
      console.error("Error in getOrderDetailsByCode:", error.message);
      res.status(404).json({ error: error.message });
    }
  }

  // Get order elements by order_id (items, extras, prices, and redemption eligibility)
  static async getOrder(req, res) {
    try {
      const orderId = req.params.orderId;
      const order = await OrderModel.getOrder(orderId);
      res.status(200).json(order);
    } catch (error) {
      console.error("Error in getOrder:", error.message);
      res.status(404).json({ error: error.message });
    }
  }

  // Get order elements by order_code (items, extras, prices, and redemption eligibility)
  static async getOrderByCode(req, res) {
    try {
      const orderCode = req.params.orderCode;
      const order = await OrderModel.getOrderByCode(orderCode);
      res.status(200).json(order);
    } catch (error) {
      console.error("Error in getOrderByCode:", error.message);
      res.status(404).json({ error: error.message });
    }
  }

  // Get all orders for admin dashboard (summary view)
  static async getAllOrdersForAdmin(req, res) {
    try {
      const orders = await OrderModel.getAllOrdersForAdmin();
      res.status(200).json(orders);
    } catch (error) {
      console.error("Error in getAllOrdersForAdmin:", error.message);
      res.status(500).json({ error: error.message });
    }
  }

  // Get all orders for a specific user
  static async getAllOrdersForUser(req, res) {
    try {
      const userId = req.user.id;
      const orders = await OrderModel.getOrdersByUserId(userId);
      res.status(200).json(orders);
    } catch (error) {
      console.error("Error in getAllOrdersForUser:", error.message);
      res.status(500).json({ error: error.message });
    }
  }

  // Search orders by partial or full order_code
  static async searchOrdersByCode(req, res) {
    try {
      const { code } = req.query;
      if (!code) {
        return res.status(400).json({ error: "Order code is required" });
      }
      const orders = await OrderModel.searchOrdersByCode(code);
      res.status(200).json(orders);
    } catch (error) {
      console.error("Error in searchOrdersByCode:", error.message);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = OrderController;
