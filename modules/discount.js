// Discount Service - Business Logic
const pool = require("./db");

class DiscountService {
    /**
     * Create a new discount with is_active = false by default
     */
    static async createDiscount(discountData) {
        const {
            user_id,
            discount_value,
            discount_code,
            discount_description,
            expires_at,
        } = discountData;

        // Validate required fields
        if (!user_id || discount_value === undefined || discount_value === null) {
            throw new Error("user_id and discount_value are required");
        }

        // Validate discount_value range
        if (discount_value < 0 || discount_value > 100000) {
            throw new Error("discount_value must be between 0 and 100000");
        }

        const query = `
      INSERT INTO discounts (
        user_id, 
        discount_value, 
        discount_code, 
        discount_description, 
        is_active,
        expires_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `;

        const values = [
            user_id,
            discount_value,
            discount_code || null,
            discount_description || null,
            false, // Always create as inactive
            expires_at || null,
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Get the currently active discount (only one can be active at a time)
     */
    static async getActiveDiscount() {
        const query = `
      SELECT 
        d.*,
        u.user_name,
        u.user_email
      FROM discounts d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.is_active = true
      LIMIT 1
    `;

        const result = await pool.query(query);
        return result.rows[0] || null;
    }

    /**
     * Activate a discount by ID
     * Deactivates all other discounts first
     */
    static async activateDiscount(discountId) {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Check if discount exists
            const checkQuery = "SELECT * FROM discounts WHERE discount_id = $1";
            const checkResult = await client.query(checkQuery, [discountId]);

            if (checkResult.rows.length === 0) {
                throw new Error("Discount not found");
            }

            // Deactivate all discounts
            await client.query(`
        UPDATE discounts 
        SET is_active = false, updated_at = NOW()
        WHERE is_active = true
      `);

            // Activate the specified discount
            const activateQuery = `
        UPDATE discounts 
        SET is_active = true, updated_at = NOW()
        WHERE discount_id = $1
        RETURNING *
      `;
            const result = await client.query(activateQuery, [discountId]);

            await client.query("COMMIT");
            return result.rows[0];
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get all discounts (active and inactive)
     */
    static async getAllDiscounts() {
        const query = `
      SELECT 
        d.*,
        u.user_name,
        u.user_email
      FROM discounts d
      LEFT JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC
    `;

        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Get discount by ID
     */
    static async getDiscountById(discountId) {
        const query = `
      SELECT 
        d.*,
        u.user_name,
        u.user_email
      FROM discounts d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.discount_id = $1
    `;

        const result = await pool.query(query, [discountId]);

        if (result.rows.length === 0) {
            throw new Error("Discount not found");
        }

        return result.rows[0];
    }

    /**
     * Delete a discount
     * Cannot delete if it's the active discount
     */
    static async deleteDiscount(discountId) {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Check if discount exists and if it's active
            const checkQuery = "SELECT * FROM discounts WHERE discount_id = $1";
            const checkResult = await client.query(checkQuery, [discountId]);

            if (checkResult.rows.length === 0) {
                throw new Error("Discount not found");
            }

            const discount = checkResult.rows[0];

            if (discount.is_active) {
                throw new Error(
                    "Cannot delete an active discount. Please activate another discount first."
                );
            }

            // Delete the discount
            const deleteQuery = `
        DELETE FROM discounts 
        WHERE discount_id = $1
        RETURNING *
      `;
            const result = await client.query(deleteQuery, [discountId]);

            await client.query("COMMIT");
            return result.rows[0];
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Update a discount
     * Cannot update if it's active (would need to deactivate first)
     */
    static async updateDiscount(discountId, updateData) {
        const { discount_value, discount_code, discount_description, expires_at } =
            updateData;

        // Check if discount is active
        const checkQuery = "SELECT is_active FROM discounts WHERE discount_id = $1";
        const checkResult = await pool.query(checkQuery, [discountId]);

        if (checkResult.rows.length === 0) {
            throw new Error("Discount not found");
        }

        if (checkResult.rows[0].is_active) {
            throw new Error(
                "Cannot update an active discount. Please deactivate it first."
            );
        }

        // Build dynamic update query
        const fields = [];
        const values = [];
        let paramCount = 1;

        if (discount_value !== undefined) {
            if (discount_value < 0 || discount_value > 100000) {
                throw new Error("discount_value must be between 0 and 100000");
            }
            fields.push(`discount_value = $${paramCount++}`);
            values.push(discount_value);
        }

        if (discount_code !== undefined) {
            fields.push(`discount_code = $${paramCount++}`);
            values.push(discount_code);
        }

        if (discount_description !== undefined) {
            fields.push(`discount_description = $${paramCount++}`);
            values.push(discount_description);
        }

        if (expires_at !== undefined) {
            fields.push(`expires_at = $${paramCount++}`);
            values.push(expires_at);
        }

        if (fields.length === 0) {
            throw new Error("No fields to update");
        }

        fields.push(`updated_at = NOW()`);
        values.push(discountId);

        const query = `
      UPDATE discounts 
      SET ${fields.join(", ")}
      WHERE discount_id = $${paramCount}
      RETURNING *
    `;

        const result = await pool.query(query, values);
        return result.rows[0];
    }
}

module.exports = DiscountService;
