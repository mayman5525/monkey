// ========================================
// CREATE ADMIN USER MIGRATION
// Version: 1.0.0
// Description: Creates the default admin user
//              Email: monkeyadmin392@gmail.com
//              Password: P@ssw0rd
//              This user cannot be deleted and will not be duplicated
// ========================================

const pool = require("../db");
const bcrypt = require("bcrypt");

async function createAdminUser() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const adminEmail = "monkeyadmin392@gmail.com";
    const adminPassword = "P@ssw0rd";
    const adminName = "Admin User";
    const adminNumber = "0000000000"; // Placeholder number

    // Check if admin user already exists
    const existingUser = await client.query(
      `SELECT id, user_email, is_admin FROM users WHERE user_email = $1`,
      [adminEmail]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      
      // Update existing user to ensure they are admin
      if (!user.is_admin) {
        await client.query(
          `UPDATE users SET is_admin = TRUE, updated_at = NOW() WHERE id = $1`,
          [user.id]
        );
        console.log(`Updated user ${user.id} to admin status`);
      } else {
        console.log(`Admin user already exists with ID: ${user.id}`);
      }
      
      await client.query("COMMIT");
      return { success: true, message: "Admin user already exists", userId: user.id };
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Create the admin user
    const result = await client.query(
      `INSERT INTO users (
        user_name, 
        user_email, 
        user_number, 
        password_hash, 
        is_admin,
        created_at, 
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, user_name, user_email, is_admin`,
      [adminName, adminEmail, adminNumber, passwordHash, true]
    );

    const newUser = result.rows[0];

    // Create a trigger function to prevent deletion of admin user
    await client.query(`
      CREATE OR REPLACE FUNCTION prevent_admin_deletion()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.user_email = 'monkeyadmin392@gmail.com' AND OLD.is_admin = TRUE THEN
          RAISE EXCEPTION 'Cannot delete the default admin user';
        END IF;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Drop trigger if exists and recreate it
    await client.query(`DROP TRIGGER IF EXISTS trigger_prevent_admin_deletion ON users;`);
    
    await client.query(`
      CREATE TRIGGER trigger_prevent_admin_deletion
      BEFORE DELETE ON users
      FOR EACH ROW
      EXECUTE FUNCTION prevent_admin_deletion();
    `);

    await client.query("COMMIT");
    
    console.log(`Admin user created successfully with ID: ${newUser.id}`);
    return { 
      success: true, 
      message: "Admin user created successfully", 
      userId: newUser.id,
      email: newUser.user_email 
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating admin user:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  createAdminUser()
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

module.exports = createAdminUser;

