const pool = require("./db");

class OrderModel {
  // Checkout: Create order, add items and extras, return order_code and total_price
  static async checkoutOrder({ user_id, items }) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Validate user_id
      const userRes = await client.query(`SELECT id FROM users WHERE id = $1`, [
        user_id,
      ]);
      if (userRes.rows.length === 0) {
        throw new Error("User not found");
      }

      // Create new order
      const orderRes = await client.query(
        `INSERT INTO orders (user_id, order_status, created_at, updated_at, points_earned, points_redeemed)
       VALUES ($1, 'pending', NOW(), NOW(), 0, 0)
       RETURNING order_id, order_code`,
        [user_id]
      );
      const { order_id: orderId, order_code: orderCode } = orderRes.rows[0];

      // Add items and extras
      for (const item of items) {
        // Validate product_id
        const productRes = await client.query(
          `SELECT product_price FROM product WHERE product_id = $1`,
          [item.product_id]
        );
        if (productRes.rows.length === 0) {
          throw new Error(`Product ${item.product_id} not found`);
        }
        const productPrice = productRes.rows[0].product_price;
        const itemTotal = productPrice * item.quantity;

        // Insert order_item
        const itemRes = await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, product_price, total_price)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING order_item_id`,
          [orderId, item.product_id, item.quantity, productPrice, itemTotal]
        );
        const orderItemId = itemRes.rows[0].order_item_id;

        // Add extras
        for (const extraId of item.extras || []) {
          // Validate extra_id
          const extraRes = await client.query(
            `SELECT extra_price FROM extras WHERE extra_id = $1`,
            [extraId]
          );
          if (extraRes.rows.length === 0) {
            throw new Error(`Extra ${extraId} not found`);
          }
          const extraPrice = extraRes.rows[0].extra_price;

          // Insert order_item_extra
          await client.query(
            `INSERT INTO order_item_extras (order_item_id, extra_id, extra_price)
           VALUES ($1, $2, $3)`,
            [orderItemId, extraId, extraPrice]
          );
        }
      }

      // Commit transaction (triggers will update total_price, points_earned, order_code)
      await client.query("COMMIT");

      // Fetch order_id, order_code, and total_price
      const finalOrderRes = await pool.query(
        `SELECT order_id, order_code, total_price FROM orders WHERE order_id = $1`,
        [orderId]
      );
      if (finalOrderRes.rows.length === 0) {
        throw new Error("Order not found after creation");
      }

      return finalOrderRes.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error during checkout:", error.message);
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
        GROUP BY o.order_id, u.id, u.user_name, u.user_email, u.user_number`)
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
  
}

module.exports = OrderModel;
