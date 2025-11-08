// Quick script to check admin user and verify password
const pool = require("../db");
const bcrypt = require("bcrypt");

async function checkAdminUser() {
  try {
    const result = await pool.query(
      `SELECT id, user_name, user_email, password_hash, is_admin FROM users WHERE user_email = $1`,
      ["monkeyadmin392@gmail.com"]
    );

    if (result.rows.length === 0) {
      console.log("❌ Admin user not found!");
      return;
    }

    const user = result.rows[0];
    console.log("✓ Admin user found:");
    console.log("  ID:", user.id);
    console.log("  Name:", user.user_name);
    console.log("  Email:", user.user_email);
    console.log("  Is Admin:", user.is_admin);
    console.log("  Password Hash:", user.password_hash ? "✓ Exists" : "❌ Missing");

    // Test password
    const testPassword = "P@ssw0rd";
    if (user.password_hash) {
      const isMatch = await bcrypt.compare(testPassword, user.password_hash);
      console.log("  Password Match:", isMatch ? "✓ Correct" : "❌ Incorrect");
      
      if (!isMatch) {
        console.log("\n⚠️  Password doesn't match! Updating password...");
        const newHash = await bcrypt.hash(testPassword, 10);
        await pool.query(
          `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
          [newHash, user.id]
        );
        console.log("✓ Password updated successfully!");
      }
    } else {
      console.log("\n⚠️  No password hash found! Setting password...");
      const newHash = await bcrypt.hash(testPassword, 10);
      await pool.query(
        `UPDATE users SET password_hash = $1, is_admin = TRUE, updated_at = NOW() WHERE id = $2`,
        [newHash, user.id]
      );
      console.log("✓ Password set and admin status updated!");
    }

    // Ensure is_admin is true
    if (!user.is_admin) {
      console.log("\n⚠️  User is not marked as admin! Updating...");
      await pool.query(
        `UPDATE users SET is_admin = TRUE, updated_at = NOW() WHERE id = $1`,
        [user.id]
      );
      console.log("✓ Admin status updated!");
    }

    pool.end();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkAdminUser();

