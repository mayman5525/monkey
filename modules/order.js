const pool = require("./db");

class OrderModel {
  // Checkout: Create order, add items and extras, return order_code and total_price
  static async checkoutOrder({ user_id, items }) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Validate user
      const userRes = await client.query(`SELECT id FROM users WHERE id = $1`, [
        user_id,
      ]);
      if (userRes.rows.length === 0) throw new Error("User not found");

      // Create order
      const orderRes = await client.query(
        `INSERT INTO orders (user_id, order_status, created_at, updated_at, points_earned, points_redeemed)
       VALUES ($1, 'pending', NOW(), NOW(), 0, 0)
       RETURNING order_id, order_code`,
        [user_id]
      );
      const { order_id: orderId, order_code: orderCode } = orderRes.rows[0];

      // Add items
      for (const item of items) {
        // Validate item structure
        if (!item.type || (!item.product_id && !item.merchant_id)) {
          throw new Error(`Invalid item structure: ${JSON.stringify(item)}`);
        }

        // Validate quantity
        if (!item.quantity || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
          throw new Error(`Invalid quantity for item: ${JSON.stringify(item)}. Quantity must be a positive integer.`);
        }

        let itemPrice, itemTotal;

        if (item.type === "product") {
          if (!item.product_id) {
            throw new Error(`Product ID is required for product type item`);
          }
          const productRes = await client.query(
            `SELECT product_price FROM product WHERE product_id = $1`,
            [item.product_id]
          );
          if (productRes.rows.length === 0)
            throw new Error(`Product ${item.product_id} not found`);
          itemPrice = parseFloat(productRes.rows[0].product_price);
          if (isNaN(itemPrice) || itemPrice < 0) {
            throw new Error(`Invalid product price for product ${item.product_id}`);
          }
        } else if (item.type === "merchant") {
          if (!item.merchant_id) {
            throw new Error(`Merchant ID is required for merchant type item`);
          }
          const merchantRes = await client.query(
            `SELECT merchant_price FROM merchant WHERE merchant_id = $1`,
            [item.merchant_id]
          );
          if (merchantRes.rows.length === 0)
            throw new Error(`Merchant ${item.merchant_id} not found`);
          itemPrice = parseFloat(merchantRes.rows[0].merchant_price);
          if (isNaN(itemPrice) || itemPrice < 0) {
            throw new Error(`Invalid merchant price for merchant ${item.merchant_id}`);
          }
        } else {
          throw new Error(`Invalid item type: ${item.type}. Must be 'product' or 'merchant'`);
        }

        itemTotal = itemPrice * item.quantity;

        // Insert into order_items
        const itemRes = await client.query(
          `INSERT INTO order_items 
           (order_id, product_id, merchant_id, quantity, product_price, total_price, item_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING order_item_id`,
          [
            orderId,
            item.type === "product" ? item.product_id : null,
            item.type === "merchant" ? item.merchant_id : null,
            item.quantity,
            itemPrice,
            itemTotal,
            item.type,
          ]
        );

        const orderItemId = itemRes.rows[0].order_item_id;

        // Extras still only apply to products
        if (item.type === "product" && item.extras?.length) {
          // Validate extras is an array
          if (!Array.isArray(item.extras)) {
            throw new Error(`Extras must be an array for product ${item.product_id}`);
          }
          
          for (const extraId of item.extras) {
            // Validate extraId
            if (!extraId || isNaN(extraId)) {
              throw new Error(`Invalid extra ID: ${extraId}`);
            }
            
            const extraRes = await client.query(
              `SELECT extra_price FROM extras WHERE extra_id = $1`,
              [extraId]
            );
            if (extraRes.rows.length === 0)
              throw new Error(`Extra ${extraId} not found`);
            const extraPrice = parseFloat(extraRes.rows[0].extra_price);
            if (isNaN(extraPrice) || extraPrice < 0) {
              throw new Error(`Invalid extra price for extra ${extraId}`);
            }

            await client.query(
              `INSERT INTO order_item_extras (order_item_id, extra_id, extra_price)
             VALUES ($1, $2, $3)`,
              [orderItemId, extraId, extraPrice]
            );
          }
        }
      }

      await client.query("COMMIT");

      const finalOrderRes = await pool.query(
        `SELECT order_id, order_code, total_price FROM orders WHERE order_id = $1`,
        [orderId]
      );

      return finalOrderRes.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error during checkout:", error.message);
      throw error;
    } finally {
      client.release();
    }
  }
  static async completeOrder(orderId, discountType, discountValue) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get order details
      const orderRes = await client.query(
        `SELECT order_id, user_id, order_status, total_price, points_earned, points_redeemed, applied_discount
         FROM orders 
         WHERE order_id = $1`,
        [orderId]
      );

      if (orderRes.rows.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderRes.rows[0];

      // Check if order is already completed
      if (order.order_status === "completed") {
        throw new Error("Order is already completed");
      }

      // Check if order is pending
      if (order.order_status !== "pending") {
        throw new Error(
          `Cannot complete order with status: ${order.order_status}`
        );
      }

      let originalTotal = parseFloat(order.total_price);
      let discountAmount = 0;
      let finalTotal = originalTotal;

      // Calculate points based on original total (before discount)
      // Points are calculated first and don't change when discount is applied
      const newPointsEarned = Math.floor(originalTotal * 10);

      // Apply discount if provided (after points calculation)
      if (discountType && discountValue !== undefined && discountValue !== null) {
        const discountVal = parseFloat(discountValue);
        
        if (isNaN(discountVal) || discountVal < 0) {
          throw new Error("Discount value must be a positive number");
        }

        if (discountType === "percentage") {
          // Validate percentage: must be 0-60
          if (discountVal < 0 || discountVal > 60) {
            throw new Error("Discount percentage must be between 0 and 60");
          }
          discountAmount = originalTotal * (discountVal / 100);
        } else if (discountType === "amount") {
          // Validate amount: must be > 0 and < 0.6 * total_price
          const maxDiscount = originalTotal * 0.6;
          if (discountVal <= 0) {
            throw new Error("Discount amount must be greater than 0");
          }
          if (discountVal >= maxDiscount) {
            throw new Error(`Discount amount must be less than ${maxDiscount.toFixed(2)} (60% of total)`);
          }
          discountAmount = discountVal;
        } else {
          throw new Error("Discount type must be 'amount' or 'percentage'");
        }

        // Calculate final total after discount
        finalTotal = Math.max(originalTotal - discountAmount, 0);
      }

      // Update order status to completed with discount applied
      await client.query(
        `UPDATE orders 
         SET order_status = 'completed', 
             total_price = $1,
             applied_discount = $2,
             points_earned = $3,
             updated_at = NOW()
         WHERE order_id = $4`,
        [finalTotal, discountAmount, newPointsEarned, orderId]
      );

      // Update user metrics
      const userMetrics = await client.query(
        `SELECT 
           COUNT(*) FILTER (WHERE order_status = 'completed') as completed_orders,
           COALESCE(SUM(total_price) FILTER (WHERE order_status = 'completed'), 0) as total_spent,
           COALESCE(SUM(points_earned) FILTER (WHERE order_status = 'completed'), 0) as total_points_earned,
           COALESCE(SUM(points_redeemed) FILTER (WHERE order_status = 'completed'), 0) as total_points_redeemed
         FROM orders 
         WHERE user_id = $1`,
        [order.user_id]
      );

      const metrics = userMetrics.rows[0];
      const completedOrders = parseInt(metrics.completed_orders);
      const totalSpent = parseFloat(metrics.total_spent);
      const avgOrderValue =
        completedOrders > 0 ? totalSpent / completedOrders : 0;

      // Update user table with recalculated metrics
      await client.query(
        `UPDATE users 
         SET total_orders = $1,
             total_spent = $2,
             avg_order_value = $3,
             last_purchase_date = NOW(),
             points = points + $4 - COALESCE((
               SELECT points_earned - points_redeemed 
               FROM orders 
               WHERE order_id = $5
             ), 0),
             points_redeemed = points_redeemed + $6,
             has_points = TRUE,
             updated_at = NOW()
         WHERE id = $7`,
        [
          completedOrders,
          totalSpent,
          avgOrderValue,
          newPointsEarned,
          orderId,
          order.points_redeemed,
          order.user_id,
        ]
      );

      await client.query("COMMIT");

      // Fetch updated order
      const updatedOrder = await pool.query(
        `SELECT order_id, order_code, order_status, total_price, points_earned, points_redeemed, applied_discount, updated_at
         FROM orders 
         WHERE order_id = $1`,
        [orderId]
      );

      return updatedOrder.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error completing order:", error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  static async applyDiscountToOrder(orderId, discountValue) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Validate input
      if (!discountValue || isNaN(discountValue) || discountValue <= 0) {
        throw new Error("Invalid discount value. Must be a positive number.");
      }

      // Get order details
      const orderRes = await client.query(
        `SELECT order_id, user_id, total_price, applied_discount, order_status
       FROM orders 
       WHERE order_id = $1`,
        [orderId]
      );

      if (orderRes.rows.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderRes.rows[0];

      if (order.order_status === "completed") {
        throw new Error("Cannot apply discount to a completed order");
      }

      if (order.applied_discount && order.applied_discount > 0) {
        throw new Error("A discount has already been applied to this order");
      }

      // Calculate percentage discount
      const totalPrice = parseFloat(order.total_price);
      const discountAmount = (totalPrice * parseFloat(discountValue)) / 100;
      const discountedTotal = Math.max(totalPrice - discountAmount, 0);

      // Apply discount to order
      await client.query(
        `UPDATE orders 
       SET applied_discount = $1, 
           total_price = $2,
           updated_at = NOW()
       WHERE order_id = $3`,
        [discountAmount, discountedTotal, orderId]
      );

      await client.query("COMMIT");

      // Fetch updated order
      const updatedOrder = await pool.query(
        `SELECT order_id, order_code, order_status, total_price, applied_discount, updated_at
       FROM orders 
       WHERE order_id = $1`,
        [orderId]
      );

      return {
        message: `Applied ${discountValue}% discount successfully`,
        discount_percentage: discountValue,
        discount_amount: discountAmount,
        order: updatedOrder.rows[0],
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error applying discount:", error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get comprehensive order details (for admin dashboard)
  static async getOrderDetails(orderId) {
    try {
      const res = await pool.query(
        `SELECT 
          o.order_id,
          o.order_status,
          o.created_at,
          o.updated_at,
          o.total_price,
          o.points_earned,
          o.points_redeemed,
          o.order_code,
          u.id AS user_id,
          u.user_name,
          u.user_email,
          u.user_number,
          json_agg(
            json_build_object(
              'order_item_id', oi.order_item_id,
              'product_id', p.product_id,
              'product_name', p.product_name,
              'product_category', p.product_category,
              'quantity', oi.quantity,
              'product_price', oi.product_price,
              'item_total', oi.total_price,
              'extras', (
                SELECT json_agg(
                  json_build_object(
                    'extra_id', e.extra_id,
                    'extra_name', e.extra_name,
                    'extra_price', oie.extra_price
                  )
                )
                FROM order_item_extras oie
                JOIN extras e ON oie.extra_id = e.extra_id
                WHERE oie.order_item_id = oi.order_item_id
              )
            )
          ) AS items
        FROM orders o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN order_items oi ON o.order_id = oi.order_id
        LEFT JOIN product p ON oi.product_id = p.product_id
        WHERE o.order_id = $1
        GROUP BY o.order_id, u.id, u.user_name, u.user_email, u.user_number`,
        [orderId]
      );
      if (res.rows.length === 0) {
        throw new Error("Order not found");
      }
      return res.rows[0];
    } catch (error) {
      console.error("Error fetching order details:", error.message);
      throw error;
    }
  }

  // Get order elements (items, extras, prices, and redemption eligibility)
  static async getOrder(orderId) {
    try {
      const res = await pool.query(
        `SELECT 
        o.order_id,
        o.order_status,
        o.total_price,
        o.points_earned,
        o.points_redeemed,
        o.order_code,
        u.points AS user_points,
        (u.points >= (o.total_price * 10)) AS can_redeem_points,
        json_agg(
          json_build_object(
            'order_item_id', oi.order_item_id,
            'product_id', p.product_id,
            'product_name', p.product_name,
            'product_category', p.product_category,
            'quantity', oi.quantity,
            'product_price', oi.product_price,
            'item_total', oi.total_price,
            'extras', (
              SELECT json_agg(
                json_build_object(
                  'extra_id', e.extra_id,
                  'extra_name', e.extra_name,
                  'extra_price', oie.extra_price
                )
              )
              FROM order_item_extras oie
              JOIN extras e ON oie.extra_id = e.extra_id
              WHERE oie.order_item_id = oi.order_item_id
            )
          )
        ) AS items,
        COALESCE(SUM(oi.total_price), 0) AS items_subtotal,
        (SELECT COALESCE(SUM(oie.extra_price), 0)
         FROM order_item_extras oie
         JOIN order_items oi2 ON oie.order_item_id = oi2.order_item_id
         WHERE oi2.order_id = o.order_id) AS extras_subtotal
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      LEFT JOIN product p ON oi.product_id = p.product_id
      WHERE o.order_id = $1
      GROUP BY o.order_id, u.points`,
        [orderId]
      );
      if (res.rows.length === 0) {
        throw new Error("Order not found");
      }
      return res.rows[0];
    } catch (error) {
      console.error("Error fetching order:", error.message);
      throw error;
    }
  }

  static async getOrderByCode(orderCode) {
    try {
      const res = await pool.query(
        `SELECT 
          o.order_id,
          o.order_status,
          o.total_price,
          o.points_earned,
          o.points_redeemed,
          o.order_code,
          u.points AS user_points,
          (u.points >= (o.total_price * 10)) AS can_redeem_points,
          json_agg(
            json_build_object(
              'order_item_id', oi.order_item_id,
              'product_id', p.product_id,
              'product_name', p.product_name,
              'product_category', p.product_category,
              'quantity', oi.quantity,
              'product_price', oi.product_price,
              'item_total', oi.total_price,
              'extras', (
                SELECT json_agg(
                  json_build_object(
                    'extra_id', e.extra_id,
                    'extra_name', e.extra_name,
                    'extra_price', oie.extra_price
                  )
                )
                FROM order_item_extras oie
                JOIN extras e ON oie.extra_id = e.extra_id
                WHERE oie.order_item_id = oi.order_item_id
              )
            )
          ) AS items,
          COALESCE(SUM(oi.total_price), 0) AS items_subtotal,
          (SELECT COALESCE(SUM(oie.extra_price), 0)
           FROM order_item_extras oie
           JOIN order_items oi2 ON oie.order_item_id = oi2.order_item_id
           WHERE oi2.order_id = o.order_id) AS extras_subtotal
        FROM orders o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN order_items oi ON o.order_id = oi.order_id
        LEFT JOIN product p ON oi.product_id = p.product_id
        WHERE o.order_code = $1
        GROUP BY o.order_id, u.points`,
        [orderCode]
      );
      if (res.rows.length === 0) {
        throw new Error("Order not found");
      }
      return res.rows[0];
    } catch (error) {
      console.error("Error fetching order by code:", error.message);
      throw error;
    }
  }
  static async getOrderDetailsByCode(orderCode) {
    try {
      const res = await pool.query(
        `SELECT 
          o.order_id,
          o.order_status,
          o.created_at,
          o.updated_at,
          o.total_price,
          o.points_earned,
          o.points_redeemed,
          o.order_code,
          u.id AS user_id,
          u.user_name,
          u.user_email,
          u.user_number,
          json_agg(
            json_build_object(
              'order_item_id', oi.order_item_id,
              'product_id', p.product_id,
              'product_name', p.product_name,
              'product_category', p.product_category,
              'quantity', oi.quantity,
              'product_price', oi.product_price,
              'item_total', oi.total_price,
              'extras', (
                SELECT json_agg(
                  json_build_object(
                    'extra_id', e.extra_id,
                    'extra_name', e.extra_name,
                    'extra_price', oie.extra_price
                  )
                )
                FROM order_item_extras oie
                JOIN extras e ON oie.extra_id = e.extra_id
                WHERE oie.order_item_id = oi.order_item_id
              )
            )
          ) AS items
        FROM orders o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN order_items oi ON o.order_id = oi.order_id
        LEFT JOIN product p ON oi.product_id = p.product_id
        WHERE o.order_code = $1
        GROUP BY o.order_id, u.id, u.user_name, u.user_email, u.user_number`,
        [orderCode]
      );
      if (res.rows.length === 0) {
        throw new Error("Order not found");
      }
      return res.rows[0];
    } catch (error) {
      console.error("Error fetching order details by code:", error.message);
      throw error;
    }
  }

  static async searchOrdersByCode(searchTerm) {
    try {
      const res = await pool.query(
        `SELECT 
          o.order_id,
          o.order_status,
          o.total_price,
          o.points_earned,
          o.points_redeemed,
          o.order_code,
          u.points AS user_points,
          (u.points >= (o.total_price * 10)) AS can_redeem_points,
          json_agg(
            json_build_object(
              'order_item_id', oi.order_item_id,
              'product_id', p.product_id,
              'product_name', p.product_name,
              'product_category', p.product_category,
              'quantity', oi.quantity,
              'product_price', oi.product_price,
              'item_total', oi.total_price,
              'extras', (
                SELECT json_agg(
                  json_build_object(
                    'extra_id', e.extra_id,
                    'extra_name', e.extra_name,
                    'extra_price', oie.extra_price
                  )
                )
                FROM order_item_extras oie
                JOIN extras e ON oie.extra_id = e.extra_id
                WHERE oie.order_item_id = oi.order_item_id
              )
            )
          ) AS items,
          COALESCE(SUM(oi.total_price), 0) AS items_subtotal,
          (SELECT COALESCE(SUM(oie.extra_price), 0)
           FROM order_item_extras oie
           JOIN order_items oi2 ON oie.order_item_id = oi2.order_item_id
           WHERE oi2.order_id = o.order_id) AS extras_subtotal
        FROM orders o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN order_items oi ON o.order_id = oi.order_id
        LEFT JOIN product p ON oi.product_id = p.product_id
        WHERE o.order_code ILIKE $1
        GROUP BY o.order_id, u.points`,
        [`%${searchTerm}%`]
      );
      return res.rows; // Return array of matching orders
    } catch (error) {
      console.error("Error searching orders by code:", error.message);
      throw error;
    }
  }
  static async getAllOrdersForAdmin() {
    try {
      const res = await pool.query(
        `SELECT 
          o.order_id,
          o.order_status,
          o.created_at,
          o.updated_at,
          o.total_price,
          o.points_earned,
          o.points_redeemed,
          o.order_code,
          u.id AS user_id,
          u.user_name,
          u.user_email,
          u.user_number,
          json_agg(
            json_build_object(
              'order_item_id', oi.order_item_id,
              'product_id', p.product_id,
              'product_name', p.product_name,
              'product_category', p.product_category,
              'quantity', oi.quantity,
              'product_price', oi.product_price,
              'item_total', oi.total_price,
              'extras', (
                SELECT json_agg(
                  json_build_object(
                    'extra_id', e.extra_id,
                    'extra_name', e.extra_name,
                    'extra_price', oie.extra_price
                  )
                )
                FROM order_item_extras oie
                JOIN extras e ON oie.extra_id = e.extra_id
                WHERE oie.order_item_id = oi.order_item_id
              )
            )
          ) AS items,
          COALESCE(SUM(oi.total_price), 0) AS items_subtotal,
          (SELECT COALESCE(SUM(oie.extra_price), 0)
           FROM order_item_extras oie
           JOIN order_items oi2 ON oie.order_item_id = oi2.order_item_id
           WHERE oi2.order_id = o.order_id) AS extras_subtotal
        FROM orders o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN order_items oi ON o.order_id = oi.order_id
        LEFT JOIN product p ON oi.product_id = p.product_id
        GROUP BY o.order_id, u.id, u.user_name, u.user_email, u.user_number`
      );
      return res.rows; // Return array of all orders
    } catch (error) {
      console.error("Error fetching all orders for admin:", error.message);
      throw error;
    }
  }
  static async getAllOrdersForUser(userId) {
    try {
      const res = await pool.query(
        `SELECT 
          o.order_id,
          o.order_status,
          o.created_at,
          o.updated_at,
          o.total_price,
          o.points_earned,
          o.points_redeemed,
          o.order_code,
          json_agg(
            json_build_object(
              'order_item_id', oi.order_item_id,
              'product_id', p.product_id,
              'product_name', p.product_name,
              'product_category', p.product_category,
              'quantity', oi.quantity,
              'product_price', oi.product_price,
              'item_total', oi.total_price,
              'extras', (
                SELECT json_agg(
                  json_build_object(
                    'extra_id', e.extra_id,
                    'extra_name', e.extra_name,
                    'extra_price', oie.extra_price
                  )
                )
                FROM order_item_extras oie
                JOIN extras e ON oie.extra_id = e.extra_id
                WHERE oie.order_item_id = oi.order_item_id
              )
            ) 
          ) AS items,
          COALESCE(SUM(oi.total_price), 0) AS items_subtotal,
          (SELECT COALESCE(SUM(oie.extra_price), 0)
            FROM order_item_extras oie
            JOIN order_items oi2 ON oie.order_item_id = oi2.order_item_id
            WHERE oi2.order_id = o.order_id) AS extras_subtotal
        FROM orders o
        LEFT JOIN order_items oi ON o.order_id = oi.order_id
        LEFT JOIN product p ON oi.product_id = p.product_id
        WHERE o.user_id = $1
        GROUP BY o.order_id`,
        [userId]
      );
      return res.rows; // Return array of user's orders
    } catch (error) {
      console.error("Error fetching all orders for user:", error.message);
      throw error;
    }
  }

  static async cancelOrder(orderId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get order details
      const orderRes = await client.query(
        `SELECT order_id, user_id, order_status, total_price
         FROM orders 
         WHERE order_id = $1`,
        [orderId]
      );

      if (orderRes.rows.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderRes.rows[0];

      // Check if order is pending (only pending orders can be cancelled)
      if (order.order_status !== "pending") {
        throw new Error(
          `Cannot cancel order with status: ${order.order_status}. Only pending orders can be cancelled.`
        );
      }

      // Update order status to cancelled
      await client.query(
        `UPDATE orders 
         SET order_status = 'cancelled', 
             updated_at = NOW()
         WHERE order_id = $1`,
        [orderId]
      );

      // Recalculate user metrics (excluding points)
      // Only count completed orders for metrics
      const userMetrics = await client.query(
        `SELECT 
           COUNT(*) FILTER (WHERE order_status = 'completed') as completed_orders,
           COALESCE(SUM(total_price) FILTER (WHERE order_status = 'completed'), 0) as total_spent
         FROM orders 
         WHERE user_id = $1`,
        [order.user_id]
      );

      const metrics = userMetrics.rows[0];
      const completedOrders = parseInt(metrics.completed_orders);
      const totalSpent = parseFloat(metrics.total_spent);
      const avgOrderValue =
        completedOrders > 0 ? totalSpent / completedOrders : 0;

      // Update user table with recalculated metrics (do NOT modify points)
      await client.query(
        `UPDATE users 
         SET total_orders = $1,
             total_spent = $2,
             avg_order_value = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [
          completedOrders,
          totalSpent,
          avgOrderValue,
          order.user_id,
        ]
      );

      await client.query("COMMIT");

      return { message: "Order cancelled successfully" };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error cancelling order:", error.message);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = OrderModel;
