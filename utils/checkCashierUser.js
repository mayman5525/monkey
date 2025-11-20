// Quick script to check cashier user in database
const pool = require("../modules/db");

async function checkUser() {
    try {
        const result = await pool.query(
            "SELECT id, user_email, user_name, is_cashier, is_admin, password_hash FROM users WHERE user_email = $1",
            ["MonkeyBrewCasheir@gmail.com"]
        );

        if (result.rows.length === 0) {
            console.log("❌ User not found in database!");
        } else {
            const user = result.rows[0];
            console.log("✓ User found:");
            console.log("  ID:", user.id);
            console.log("  Email:", user.user_email);
            console.log("  Name:", user.user_name);
            console.log("  is_cashier:", user.is_cashier);
            console.log("  is_admin:", user.is_admin);
            console.log("  password_hash:", user.password_hash ? `${user.password_hash.substring(0, 20)}...` : "NULL");

            // Test password
            const bcrypt = require("bcrypt");
            const testPassword = "@195Kr-7E#";
            const isMatch = await bcrypt.compare(testPassword, user.password_hash || "");
            console.log("\n  Password test (@195Kr-7E#):", isMatch ? "✓ MATCHES" : "❌ DOES NOT MATCH");
        }

        process.exit(0);
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
}

checkUser();
