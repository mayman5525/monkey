-- ========================================
-- PERFORMANCE INDEXES MIGRATION
-- Version: 1.0.0
-- Description: Add comprehensive indexes to prevent database bottlenecks
--              Optimizes frequently queried columns and join operations
-- ========================================

BEGIN;

-- ========================================
-- SECTION 1: USERS TABLE INDEXES
-- ========================================

-- Email lookup (case-insensitive) - may already exist, but ensure it's there
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(user_email));

-- Phone number lookup
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(user_number);

-- Admin users lookup
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;

-- Points-related queries
CREATE INDEX IF NOT EXISTS idx_users_has_points ON users(has_points) WHERE has_points = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_points ON users(points) WHERE points > 0;

-- Frequent visitor queries
CREATE INDEX IF NOT EXISTS idx_users_frequent_visitor ON users(is_frequent_visitor) WHERE is_frequent_visitor = TRUE;

-- Date-based queries
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_last_purchase ON users(last_purchase_date DESC) WHERE last_purchase_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_last_visit ON users(last_visit DESC) WHERE last_visit IS NOT NULL;

-- Composite index for user analytics queries
CREATE INDEX IF NOT EXISTS idx_users_analytics ON users(id, total_orders, total_spent, points);

-- ========================================
-- SECTION 2: ORDERS TABLE INDEXES
-- ========================================

-- User and status queries (may already exist)
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, order_status, created_at DESC);

-- Status and date queries (may already exist)
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(order_status, created_at DESC);

-- User-specific order queries
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);

-- Date range queries
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at DESC);

-- Order code lookup (unique identifier)
CREATE INDEX IF NOT EXISTS idx_orders_code ON orders(order_code) WHERE order_code IS NOT NULL;

-- Discount-related queries
CREATE INDEX IF NOT EXISTS idx_orders_discount_id ON orders(discount_id) WHERE discount_id IS NOT NULL;

-- Composite index for order history queries
CREATE INDEX IF NOT EXISTS idx_orders_user_status_date ON orders(user_id, order_status, created_at DESC);

-- ========================================
-- SECTION 3: PRODUCT TABLE INDEXES
-- ========================================

-- Category lookups
CREATE INDEX IF NOT EXISTS idx_product_category_id ON product(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_category_name ON product(product_category) WHERE product_category IS NOT NULL;

-- Featured products
CREATE INDEX IF NOT EXISTS idx_product_is_featured ON product(is_featured) WHERE is_featured = TRUE;

-- Products with points
CREATE INDEX IF NOT EXISTS idx_product_has_points ON product(has_points) WHERE has_points = TRUE;

-- Price range queries
CREATE INDEX IF NOT EXISTS idx_product_price ON product(product_price);

-- Name search
CREATE INDEX IF NOT EXISTS idx_product_name ON product(product_name);

-- Date-based queries
CREATE INDEX IF NOT EXISTS idx_product_created_at ON product(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_updated_at ON product(updated_at DESC);

-- Composite index for product listings
CREATE INDEX IF NOT EXISTS idx_product_category_featured ON product(category_id, is_featured, created_at DESC) WHERE category_id IS NOT NULL;

-- ========================================
-- SECTION 4: CATEGORY TABLE INDEXES
-- ========================================

-- Category name lookup (unique, but index helps with joins)
CREATE INDEX IF NOT EXISTS idx_category_name ON category(category_name);

-- Date-based queries
CREATE INDEX IF NOT EXISTS idx_category_created_at ON category(created_at DESC);

-- ========================================
-- SECTION 5: ORDER_ITEMS TABLE INDEXES
-- ========================================

-- Order lookup (may already exist)
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Product lookup (may already exist)
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id) WHERE product_id IS NOT NULL;

-- Merchant lookup (may already exist)
CREATE INDEX IF NOT EXISTS idx_order_items_merchant ON order_items(merchant_id) WHERE merchant_id IS NOT NULL;

-- Composite index for order details queries
CREATE INDEX IF NOT EXISTS idx_order_items_order_product ON order_items(order_id, product_id);

-- ========================================
-- SECTION 6: ORDER_ITEM_EXTRAS TABLE INDEXES
-- ========================================

-- Order item lookup (may already exist)
CREATE INDEX IF NOT EXISTS idx_order_item_extras_item ON order_item_extras(order_item_id);

-- Extra lookup
CREATE INDEX IF NOT EXISTS idx_order_item_extras_extra ON order_item_extras(extra_id);

-- Composite index for extra usage analytics
CREATE INDEX IF NOT EXISTS idx_order_item_extras_extra_item ON order_item_extras(extra_id, order_item_id);

-- ========================================
-- SECTION 7: EXTRAS TABLE INDEXES
-- ========================================

-- Name lookup
CREATE INDEX IF NOT EXISTS idx_extras_name ON extras(extra_name);

-- Price queries
CREATE INDEX IF NOT EXISTS idx_extras_price ON extras(extra_price);

-- Date-based queries
CREATE INDEX IF NOT EXISTS idx_extras_created_at ON extras(created_at DESC);

-- ========================================
-- SECTION 8: DISCOUNTS TABLE INDEXES
-- ========================================

-- User and active status (may already exist)
CREATE INDEX IF NOT EXISTS idx_discounts_user_active ON discounts(user_id, is_active, expires_at) WHERE is_active = TRUE;

-- User lookup
CREATE INDEX IF NOT EXISTS idx_discounts_user_id ON discounts(user_id);

-- Active discounts
CREATE INDEX IF NOT EXISTS idx_discounts_is_active ON discounts(is_active) WHERE is_active = TRUE;

-- Expiry queries
CREATE INDEX IF NOT EXISTS idx_discounts_expires_at ON discounts(expires_at) WHERE expires_at IS NOT NULL;

-- Discount code lookup
CREATE INDEX IF NOT EXISTS idx_discounts_code ON discounts(discount_code) WHERE discount_code IS NOT NULL;

-- Date-based queries
CREATE INDEX IF NOT EXISTS idx_discounts_created_at ON discounts(created_at DESC);

-- ========================================
-- SECTION 9: FORMS TABLE INDEXES
-- ========================================

-- Email lookup
CREATE INDEX IF NOT EXISTS idx_forms_email ON forms(email) WHERE email IS NOT NULL;

-- Phone lookup
CREATE INDEX IF NOT EXISTS idx_forms_phone ON forms(phone_number);

-- Date-based queries
CREATE INDEX IF NOT EXISTS idx_forms_created_at ON forms(created_at DESC);

-- Composite index for potential clients queries
CREATE INDEX IF NOT EXISTS idx_forms_email_phone ON forms(email, phone_number);

-- ========================================
-- SECTION 10: MERCHANT TABLE INDEXES (if exists)
-- ========================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'merchant') THEN
        CREATE INDEX IF NOT EXISTS idx_merchant_name ON merchant(merchant_name);
        CREATE INDEX IF NOT EXISTS idx_merchant_category ON merchant(merchant_category) WHERE merchant_category IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_merchant_price ON merchant(merchant_price);
        CREATE INDEX IF NOT EXISTS idx_merchant_created_at ON merchant(created_at DESC);
    END IF;
END $$;

-- ========================================
-- SECTION 11: VERIFY INDEXES
-- ========================================

DO $$
DECLARE
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'orders', 'product', 'category', 'order_items', 
                        'order_item_extras', 'extras', 'discounts', 'forms');

    RAISE NOTICE 'Successfully created/verified % indexes across all tables', index_count;
END $$;

-- ========================================
-- SECTION 12: UPDATE TABLE STATISTICS
-- ========================================

-- Update statistics for query planner optimization
ANALYZE users;
ANALYZE orders;
ANALYZE product;
ANALYZE category;
ANALYZE order_items;
ANALYZE order_item_extras;
ANALYZE extras;
ANALYZE discounts;
ANALYZE forms;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'merchant') THEN
        ANALYZE merchant;
    END IF;
END $$;

COMMIT;

