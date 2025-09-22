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

-- -- PRODUCTS TABLE
-- CREATE TABLE IF NOT EXISTS products (
--     id SERIAL PRIMARY KEY,
--     product_name TEXT NOT NULL,
--     product_description TEXT,
--     product_photo TEXT,
--     product_price NUMERIC NOT NULL,
--     product_category TEXT NOT NULL,
--     has_points BOOLEAN DEFAULT FALSE
-- );

-- FORMS TABLE
CREATE TABLE IF NOT EXISTS forms (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone_number BIGINT NOT NULL,
    email TEXT
);
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

-- Add columns to users before INSERT (removed preferred_product add since dropped later)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS google_id TEXT,
    ADD COLUMN IF NOT EXISTS reset_code TEXT,
    ADD COLUMN IF NOT EXISTS reset_code_expiry TIMESTAMP,
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS points_redeemed INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_spent INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS avg_order_value INTEGER DEFAULT 0;

ALTER TABLE users DROP COLUMN IF EXISTS user_id;

ALTER TABLE users ALTER COLUMN user_name SET NOT NULL;
ALTER TABLE users ALTER COLUMN user_email SET NOT NULL;

ALTER TABLE users ALTER COLUMN user_number TYPE TEXT USING user_number::TEXT;
ALTER TABLE users ALTER COLUMN user_number SET NOT NULL;

ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;

-- INSERT after column adds
INSERT INTO users (user_name, user_email, user_number, password_hash, points)
VALUES ('Jsaohn Doe', 'josshn@example.com', '12345567890', 'hashed_password', 100);

-- Create other tables
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


ALTER TABLE product
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_points BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS product_photo TEXT;



DO $$
BEGIN
    -- Change total_spent to NUMERIC for precision
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='users' AND column_name='total_spent' AND data_type='integer'
    ) THEN
        ALTER TABLE users ALTER COLUMN total_spent TYPE NUMERIC USING total_spent::NUMERIC;
    END IF;

    -- Change avg_order_value to NUMERIC for precision
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='users' AND column_name='avg_order_value' AND data_type='integer'
    ) THEN
        ALTER TABLE users ALTER COLUMN avg_order_value TYPE NUMERIC USING avg_order_value::NUMERIC;
    END IF;

    -- Rename visits_ber_week to visits_per_week
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='users' AND column_name='visits_ber_week'
    ) THEN
        ALTER TABLE users RENAME COLUMN visits_ber_week TO visits_per_week;
    END IF;

    -- Replace preferred_product (TIMESTAMP) with preferred_products (TEXT[])
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='users' AND column_name='preferred_product'
    ) THEN
        ALTER TABLE users DROP COLUMN preferred_product;
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='users' AND column_name='preferred_products'
    ) THEN
        ALTER TABLE users ADD COLUMN preferred_products TEXT[];
    END IF;

    -- Remove redundant number_of_points column
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='users' AND column_name='number_of_points'
    ) THEN
        ALTER TABLE users DROP COLUMN number_of_points;
    END IF;

    -- Add columns for retention and preferences
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='users' AND column_name='last_purchase_date'
    ) THEN
        ALTER TABLE users ADD COLUMN last_purchase_date TIMESTAMP;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='users' AND column_name='preferred_categories'
    ) THEN
        ALTER TABLE users ADD COLUMN preferred_categories TEXT[];
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='users' AND column_name='preferred_extras'
    ) THEN
        ALTER TABLE users ADD COLUMN preferred_extras TEXT[];
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='users' AND column_name='last_visit'
    ) THEN
        ALTER TABLE users ADD COLUMN last_visit TIMESTAMP;
    END IF;

    -- Update has_points based on points or points_redeemed
    UPDATE users
    SET has_points = TRUE
    WHERE points > 0 OR points_redeemed > 0;
END $$;

CREATE OR REPLACE FUNCTION update_user_metrics()
RETURNS TRIGGER AS $$
DECLARE
    total_count INTEGER;
    total_spend NUMERIC;
    new_points INTEGER;
BEGIN
    total_count := (SELECT COUNT(*) FROM orders WHERE user_id = NEW.user_id);

    total_spend := (SELECT COALESCE(SUM(oi.total_price), 0) + COALESCE(SUM(oie.extra_price), 0)
                    FROM orders o
                    LEFT JOIN order_items oi ON o.order_id = oi.order_id
                    LEFT JOIN order_item_extras oie ON oi.order_item_id = oie.order_item_id
                    WHERE o.user_id = NEW.user_id);

    new_points := ((SELECT COALESCE(SUM(oi.total_price), 0) + COALESCE(SUM(oie.extra_price), 0)
                    FROM order_items oi
                    LEFT JOIN order_item_extras oie ON oi.order_item_id = oie.order_item_id
                    WHERE oi.order_id = NEW.order_id) * 10)::INTEGER;

    UPDATE users
    SET 
        total_orders = total_count,
        total_spent = total_spend,
        avg_order_value = CASE WHEN total_count > 0 THEN total_spend / total_count ELSE 0 END,
        last_purchase_date = NOW(),
        points = points + new_points,
        has_points = TRUE,
        updated_at = NOW()
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function after an order is inserted
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trigger_update_user_metrics'
    ) THEN
        CREATE TRIGGER trigger_update_user_metrics
        AFTER INSERT ON orders
        FOR EACH ROW
        EXECUTE FUNCTION update_user_metrics();
    END IF;
    -- Only insert extras if the extras table is empty
    IF NOT EXISTS (SELECT * FROM extras) THEN
        INSERT INTO extras (extra_name, extra_price)
        VALUES ('Espresso Shot', 35),
            ('Almond Milk', 40),
             ('Coconut Milk', 40),
            ('Flavors', 35),
            ('Whipped Cream', 30),
            ('Oat Milk', 40);
    END IF;

END $$;