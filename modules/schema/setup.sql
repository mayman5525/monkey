-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_email TEXT,
    user_number BIGINT NOT NULL,
    is_new BOOLEAN DEFAULT TRUE,
    has_points BOOLEAN DEFAULT FALSE
);

-- PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    product_name TEXT NOT NULL,
    product_description TEXT,
    product_photo TEXT,
    product_price NUMERIC NOT NULL,
    product_category TEXT NOT NULL,
    has_points BOOLEAN DEFAULT FALSE
);

-- FORMS TABLE
CREATE TABLE IF NOT EXISTS forms (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone_number BIGINT NOT NULL,
    email TEXT
);
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS google_id TEXT,
ADD COLUMN IF NOT EXISTS reset_code TEXT,
ADD COLUMN IF NOT EXISTS reset_code_expiry TIMESTAMP;

ALTER TABLE forms
ADD COLUMN IF NOT EXISTS messages TEXT NULL;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns 
        WHERE table_name='forms' AND column_name='created_at'
    ) THEN
        ALTER TABLE forms ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns 
        WHERE table_name='forms' AND column_name='updated_at'
    ) THEN
        ALTER TABLE forms ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns
        WHERE table_name='users' 
        AND column_name='number_of_points'
    ) THEN 
        ALTER TABLE users ADD COLUMN number_of_points INTEGER DEFAULT 0;
    END IF;
END $$;