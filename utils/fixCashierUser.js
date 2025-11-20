// Script to delete and recreate cashier user with correct password
const pool = require("../modules/db");
const bcrypt = require("bcrypt");

async function fixCashierUser() {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const cashierEmail = "MonkeyBrewCasheir@gmail.com";
        const cashierPassword = "@195Kr-7E#";
        const cashierName = "Monkey Brew Cashier";
        const cashierNumber = "0000000002";

        // Delete existing user
        const deleteResult = await client.query(
            "DELETE FROM users WHERE user_email = $1 RETURNING id",
            [cashierEmail]
        );

        if (deleteResult.rows.length > 0) {
            console.log(`✓ Deleted existing cashier user (ID: ${deleteResult.rows[0].id})`);
        }

        // Ensure is_cashier column exists
        await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_cashier BOOLEAN DEFAULT FALSE;
    `);

        // Hash the password CORRECTLY
        console.log("Hashing password...");
        const passwordHash = await bcrypt.hash(cashierPassword, 10);
        console.log(`✓ Password hashed: ${passwordHash.substring(0, 20)}...`);

        // Create the cashier user with CORRECT hash
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

        // Verify the password works
        const testMatch = await bcrypt.compare(cashierPassword, passwordHash);
        console.log(`✓ Password verification test: ${testMatch ? "PASSED" : "FAILED"}`);

        await client.query("COMMIT");

        console.log(`\n✓ Cashier user recreated successfully!`);
        console.log(`  ID: ${newUser.id}`);
        console.log(`  Email: ${newUser.user_email}`);
        console.log(`  is_cashier: ${newUser.is_cashier}`);
        console.log(`\nYou can now login with:`);
        console.log(`  Email: MonkeyBrewCasheir@gmail.com`);
        console.log(`  Password: @195Kr-7E#`);

        process.exit(0);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error:", error.message);
        process.exit(1);
    } finally {
        client.release();
    }
}

fixCashierUser();
