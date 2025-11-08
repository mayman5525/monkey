-- ========================================
-- CREATE ADMIN USER MIGRATION (SQL Version)
-- Version: 1.0.0
-- Description: Creates the default admin user
--              Email: monkeyadmin392@gmail.com
--              Password: P@ssw0rd (pre-hashed)
--              This user cannot be deleted and will not be duplicated
-- ========================================
-- IMPORTANT: This SQL file requires a pre-hashed password.
--            RECOMMENDED: Use create_admin_user.js instead which handles hashing automatically.
--            To use this SQL file, you must first generate the bcrypt hash and replace the placeholder.
-- ========================================

BEGIN;

-- Create trigger function to prevent deletion of admin user
CREATE OR REPLACE FUNCTION prevent_admin_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.user_email = 'monkeyadmin392@gmail.com' AND OLD.is_admin = TRUE THEN
    RAISE EXCEPTION 'Cannot delete the default admin user';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate it
DROP TRIGGER IF EXISTS trigger_prevent_admin_deletion ON users;

CREATE TRIGGER trigger_prevent_admin_deletion
BEFORE DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_admin_deletion();

-- Insert admin user only if it doesn't exist
-- Password hash for "P@ssw0rd" (bcrypt, 10 rounds)
-- NOTE: You need to generate this hash using: node -e "require('bcrypt').hash('P@ssw0rd', 10).then(h => console.log(h))"
DO $$
DECLARE
  admin_email TEXT := 'monkeyadmin392@gmail.com';
  admin_name TEXT := 'Admin User';
  admin_number TEXT := '0000000000';
  -- This hash needs to be generated - placeholder for now
  -- Run: node -e "require('bcrypt').hash('P@ssw0rd', 10).then(h => console.log(h))"
  password_hash TEXT := '$2b$10$YOUR_HASH_HERE'; -- REPLACE WITH ACTUAL HASH
  user_exists BOOLEAN;
BEGIN
  -- Check if user already exists
  SELECT EXISTS(SELECT 1 FROM users WHERE user_email = admin_email) INTO user_exists;
  
  IF NOT user_exists THEN
    -- Insert new admin user
    INSERT INTO users (
      user_name, 
      user_email, 
      user_number, 
      password_hash, 
      is_admin,
      created_at, 
      updated_at
    ) VALUES (
      admin_name,
      admin_email,
      admin_number,
      password_hash,
      TRUE,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Admin user created successfully';
  ELSE
    -- Update existing user to ensure they are admin
    UPDATE users 
    SET is_admin = TRUE, updated_at = NOW()
    WHERE user_email = admin_email AND is_admin = FALSE;
    
    RAISE NOTICE 'Admin user already exists';
  END IF;
END $$;

COMMIT;

