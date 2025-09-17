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


ALTER TABLE users DROP COLUMN IF EXISTS user_id;

ALTER TABLE users ALTER COLUMN user_name SET NOT NULL;
ALTER TABLE users ALTER COLUMN user_email SET NOT NULL;

ALTER TABLE users ALTER COLUMN user_number TYPE TEXT USING user_number::TEXT;
ALTER TABLE users ALTER COLUMN user_number SET NOT NULL;

ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
ALTER TABLE forms
ADD COLUMN IF NOT EXISTS messages TEXT ;


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


CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    order_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS category (
    category_id SERIAL PRIMARY KEY,
    category_name TEXT NOT NULL UNIQUE, -- Added UNIQUE
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- PRODUCT TABLE
CREATE TABLE IF NOT EXISTS product (
    product_id SERIAL PRIMARY KEY,
    product_name TEXT NOT NULL,
    product_components TEXT,
    product_price NUMERIC NOT NULL,
    product_category TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (product_category) REFERENCES category(category_name)
);
-- EXTRAS TABLE
CREATE TABLE IF NOT EXISTS extras (
    extra_id SERIAL PRIMARY KEY,
    extra_name TEXT NOT NULL,
    extra_description TEXT,
    extra_price NUMERIC NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ORDER_ITEMS TABLE
CREATE TABLE IF NOT EXISTS order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(order_id),
    product_id INTEGER REFERENCES product(product_id),
    quantity INTEGER NOT NULL,
    product_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL
);

-- ORDER_ITEM_EXTRAS TABLE
CREATE TABLE IF NOT EXISTS order_item_extras (
    order_item_extra_id SERIAL PRIMARY KEY,
    order_item_id INTEGER REFERENCES order_items(order_item_id),
    extra_id INTEGER REFERENCES extras(extra_id),
    extra_price NUMERIC NOT NULL
);
