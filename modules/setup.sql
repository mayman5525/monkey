-- users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_email TEXT,
    user_number BIGINT NOT NULL,
    is_new BOOLEAN DEFAULT TRUE,
    has_points BOOLEAN DEFAULT FALSE
);

-- products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    product_name TEXT NOT NULL,
    product_description TEXT,
    product_photo TEXT,
    product_price NUMERIC NOT NULL,
    product_category TEXT NOT NULL,
    has_points BOOLEAN DEFAULT FALSE
);

-- forms table
CREATE TABLE forms (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone_number BIGINT NOT NULL,
    email TEXT
);
