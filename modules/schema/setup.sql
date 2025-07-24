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
