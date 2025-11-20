// ========================================
// CREATE CASHIER USER MIGRATION
// Version: 1.0.0
// Description: Creates the cashier user
//              Email: MonkeyBrewCasheir@gmail.com
//              Password: @195Kr-7E#
//              This user is a cashier and will not be duplicated
// ========================================

const pool = require("../db");
const bcrypt = require("bcrypt");

async function createCashierUser() {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const cashierEmail = "MonkeyBrewCasheir@gmail.com";
        const cashierPassword = "@195Kr-7E#";
        const cashierName = "Monkey Brew Cashier";
        const cashierNumber = "0000000002"; // Placeholder number

        // First, ensure the is_cashier column exists
        await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_cashier BOOLEAN DEFAULT FALSE;
    `);

        console.log("✓ Ensured is_cashier column exists");

        // Check if cashier user already exists
        const existingUser = await client.query(
            `SELECT id, user_email, is_cashier FROM users WHERE user_email = $1`,
            [cashierEmail]
        );

        if (existingUser.rows.length > 0) {
            const user = existingUser.rows[0];

            // Update existing user to ensure they are cashier
            if (!user.is_cashier) {
                await client.query(
                    `UPDATE users SET is_cashier = TRUE, is_admin = FALSE, updated_at = NOW() WHERE id = $1`,
                    [user.id]
                );
                console.log(`Updated user ${user.id} to cashier status`);
            } else {
                console.log(`Cashier user already exists with ID: ${user.id}`);
            }

            await client.query("COMMIT");
            return { success: true, message: "Cashier user already exists", userId: user.id };
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(cashierPassword, 10);

        // Create the cashier user
        const result = await client.query(
            `INSERT INTO users (
        user_name, 
        user_email, 
        user_number, 
        password_hash, 
        is_cashier,
        is_admin,
        created_at, 
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, user_name, user_email, is_cashier, is_admin`,
            [cashierName, cashierEmail, cashierNumber, passwordHash, true, false]
        );

        const newUser = result.rows[0];

        await client.query("COMMIT");

        console.log(`Cashier user created successfully with ID: ${newUser.id}`);
        return {
            success: true,
            message: "Cashier user created successfully",
            userId: newUser.id,
            email: newUser.user_email
        };
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error creating cashier user:", error);
        throw error;
    } finally {
        client.release();
    }
}

// Run the migration if this file is executed directly
if (require.main === module) {
    createCashierUser()
        .then((result) => {
            console.log("✓ Migration completed successfully!");
            console.log("  Result:", JSON.stringify(result, null, 2));
            process.exit(0);
        })
        .catch((error) => {
            console.error("✗ Migration failed:", error.message);
            process.exit(1);
        });
}

module.exports = createCashierUser;
