-- ========================================
-- CRITICAL FIXES MIGRATION
-- Version: 1.0.0 - HOTFIX
-- Date: 2025-10-31
-- Description: Fixes critical bugs without breaking existing functionality
-- ========================================

BEGIN;

-- ========================================
-- SECTION 1: SAFETY ANNOUNCEMENT
-- ========================================
-- This script performs critical fixes. Run only once in production.

-- ========================================
-- SECTION 2: FIX ORDER_CODE GENERATION
-- Critical: Prevent infinite loops and collisions
-- ========================================

DROP TRIGGER IF EXISTS trigger_generate_order_code ON orders;
DROP FUNCTION IF EXISTS generate_order_code() CASCADE;

-- Create sequence for more reliable code generation
CREATE SEQUENCE IF NOT EXISTS order_code_seq START 1 CYCLE;

CREATE OR REPLACE FUNCTION generate_order_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code TEXT;
    attempt INT := 0;
    max_attempts INT := 50;
    seq_val BIGINT;
BEGIN
    -- If order_code already set, don't override
    IF NEW.order_code IS NOT NULL AND NEW.order_code != '' THEN
        RETURN NEW;
    END IF;

    LOOP
        -- Use sequence-based approach for better uniqueness
        seq_val := nextval('order_code_seq');
        
        -- Generate 4-digit code from sequence (with wraparound)
        new_code := LPAD((seq_val % 10000)::TEXT, 4, '0');
        
        -- Check if code exists
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM orders WHERE order_code = new_code
        );
        
        attempt := attempt + 1;
        
        -- If too many collisions, expand to 6 digits
        IF attempt > 20 THEN
            new_code := LPAD((FLOOR(RANDOM() * 1000000))::TEXT, 6, '0');
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM orders WHERE order_code = new_code
            );
        END IF;
        
        -- Emergency exit to prevent infinite loop
        IF attempt >= max_attempts THEN
            new_code := TO_CHAR(NOW(), 'HHMI') || LPAD((FLOOR(RANDOM() * 100))::TEXT, 2, '0');
            EXIT;
        END IF;
    END LOOP;

    NEW.order_code := new_code;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_order_code
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION generate_order_code();


-- ========================================
-- SECTION 3: FIX ORDER TOTAL CALCULATION
-- ========================================

DROP TRIGGER IF EXISTS trigger_update_order_total_items ON order_items;
DROP TRIGGER IF EXISTS trigger_update_order_total_extras ON order_item_extras;
DROP FUNCTION IF EXISTS update_order_total() CASCADE;

CREATE OR REPLACE FUNCTION update_order_total()
RETURNS TRIGGER AS $$
DECLARE
    delta NUMERIC := 0;
    target_order_id INTEGER := NULL;
    new_total NUMERIC := 0;
BEGIN
    IF TG_TABLE_NAME = 'order_items' THEN
        IF TG_OP = 'DELETE' THEN
            target_order_id := OLD.order_id;
            delta := -OLD.total_price;
        ELSIF TG_OP = 'INSERT' THEN
            target_order_id := NEW.order_id;
            delta := NEW.total_price;
        ELSE
            target_order_id := NEW.order_id;
            delta := NEW.total_price - OLD.total_price;
        END IF;
    ELSIF TG_TABLE_NAME = 'order_item_extras' THEN
        IF TG_OP = 'DELETE' THEN
            SELECT order_id INTO target_order_id
            FROM order_items
            WHERE order_item_id = OLD.order_item_id;
            delta := -OLD.extra_price;
        ELSIF TG_OP = 'INSERT' THEN
            SELECT order_id INTO target_order_id
            FROM order_items
            WHERE order_item_id = NEW.order_item_id;
            delta := NEW.extra_price;
        ELSE
            SELECT order_id INTO target_order_id
            FROM order_items
            WHERE order_item_id = NEW.order_item_id;
            delta := NEW.extra_price - OLD.extra_price;
        END IF;
    END IF;

    IF target_order_id IS NULL OR delta = 0 THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- Update total_price first, then compute points based on new total
    UPDATE orders
    SET total_price = COALESCE(total_price, 0) + delta,
        updated_at = NOW()
    WHERE order_id = target_order_id
    RETURNING total_price INTO new_total;

    UPDATE orders
    SET points_earned = (COALESCE(new_total, 0) * 10)::INTEGER
    WHERE order_id = target_order_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_total_items
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_order_total();

CREATE TRIGGER trigger_update_order_total_extras
AFTER INSERT OR UPDATE OR DELETE ON order_item_extras
FOR EACH ROW
EXECUTE FUNCTION update_order_total();


-- ========================================
-- SECTION 4: FIX DISCOUNT APPLICATION LOGIC
-- ========================================

DROP TRIGGER IF EXISTS trg_calculate_discount ON orders;
DROP FUNCTION IF EXISTS calculate_discount() CASCADE;

CREATE OR REPLACE FUNCTION calculate_discount()
RETURNS TRIGGER AS $$
DECLARE
    v_discount_record RECORD;
    v_current_total NUMERIC;
    v_new_total NUMERIC;
BEGIN
    -- Only apply discount when transitioning TO 'confirmed'
    IF NEW.order_status <> 'confirmed' OR OLD.order_status = 'confirmed' THEN
        RETURN NEW;
    END IF;

    v_current_total := COALESCE(NEW.total_price, 0);

    IF v_current_total <= 0 THEN
        RETURN NEW;
    END IF;

    SELECT discount_id, discount_value
    INTO v_discount_record
    FROM discounts
    WHERE user_id = NEW.user_id
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
      AND discount_value > 0
    ORDER BY discount_value DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_discount_record IS NULL THEN
        RETURN NEW;
    END IF;

    v_new_total := GREATEST(v_current_total - v_discount_record.discount_value, 0);

    NEW.applied_discount := v_discount_record.discount_value;
    NEW.discount_id := v_discount_record.discount_id;
    NEW.total_price := ROUND(v_new_total, 2);
    NEW.points_earned := (NEW.total_price * 10)::INTEGER;
    NEW.updated_at := NOW();

    UPDATE discounts
    SET is_active = FALSE,
        used_at = NOW(),
        updated_at = NOW()
    WHERE discount_id = v_discount_record.discount_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_discount
BEFORE UPDATE OF order_status ON orders
FOR EACH ROW
WHEN (OLD.order_status IS DISTINCT FROM NEW.order_status)
EXECUTE FUNCTION calculate_discount();


-- ========================================
-- SECTION 5: FIX VISIT FREQUENCY CALCULATION
-- ========================================

DROP TRIGGER IF EXISTS trg_update_user_visit_frequency ON orders;
DROP FUNCTION IF EXISTS update_user_visit_frequency() CASCADE;

CREATE OR REPLACE FUNCTION update_user_visit_frequency()
RETURNS TRIGGER AS $$
DECLARE
    v_visits_60d INTEGER;
    v_visits_14d INTEGER;
    v_first_completed TIMESTAMP;
    v_weeks_active NUMERIC;
    v_visits_per_week NUMERIC;
    v_is_frequent BOOLEAN;
BEGIN
    -- Only trigger on transition TO 'completed'
    IF NEW.order_status <> 'completed' OR OLD.order_status = 'completed' THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO v_visits_60d
    FROM orders
    WHERE user_id = NEW.user_id
      AND order_status = 'completed'
      AND created_at >= NOW() - INTERVAL '60 days';

    SELECT COUNT(*) INTO v_visits_14d
    FROM orders
    WHERE user_id = NEW.user_id
      AND order_status = 'completed'
      AND created_at >= NOW() - INTERVAL '14 days';

    SELECT MIN(created_at) INTO v_first_completed
    FROM orders
    WHERE user_id = NEW.user_id
      AND order_status = 'completed';

    IF v_first_completed IS NULL THEN
        v_weeks_active := 1;
    ELSE
        v_weeks_active := GREATEST(EXTRACT(EPOCH FROM (NOW() - v_first_completed)) / 604800.0, 1);
    END IF;

    v_visits_per_week := v_visits_60d::NUMERIC / LEAST(v_weeks_active, 8.571428);
    v_is_frequent := (v_visits_per_week >= 1.0 AND v_visits_14d >= 2);

    UPDATE users
    SET
        last_visit = NOW(),
        visits_per_week = ROUND(v_visits_per_week, 2),
        is_frequent_visitor = v_is_frequent,
        updated_at = NOW()
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_user_visit_frequency
AFTER UPDATE OF order_status ON orders
FOR EACH ROW
WHEN (OLD.order_status IS DISTINCT FROM NEW.order_status)
EXECUTE FUNCTION update_user_visit_frequency();


-- ========================================
-- SECTION 6: FIX UPDATE_USER_METRICS
-- ========================================

DROP TRIGGER IF EXISTS trigger_update_user_metrics ON orders;
DROP FUNCTION IF EXISTS update_user_metrics() CASCADE;

CREATE OR REPLACE FUNCTION update_user_metrics()
RETURNS TRIGGER AS $$
DECLARE
    total_count INTEGER;
    total_spend NUMERIC;
    new_points INTEGER;
BEGIN
    total_count := (
        SELECT COUNT(*) FROM orders
        WHERE user_id = NEW.user_id
          AND order_status = 'completed'
    );

    total_spend := (
        SELECT COALESCE(SUM(o.total_price), 0)
        FROM orders o
        WHERE o.user_id = NEW.user_id
          AND o.order_status = 'completed'
    );

    IF NEW.order_status = 'completed' THEN
        new_points := COALESCE(NEW.points_earned, 0);
    ELSE
        new_points := 0;
    END IF;

    UPDATE users
    SET 
        total_orders = total_count,
        total_spent = total_spend,
        avg_order_value = CASE 
            WHEN total_count > 0 THEN ROUND(total_spend / total_count, 2)
            ELSE 0 
        END,
        last_purchase_date = CASE 
            WHEN NEW.order_status = 'completed' THEN NOW()
            ELSE last_purchase_date
        END,
        points = CASE 
            WHEN NEW.order_status = 'completed' THEN points + new_points
            ELSE points
        END,
        has_points = CASE
            WHEN NEW.order_status = 'completed' THEN (points + new_points > 0)
            ELSE has_points
        END,
        updated_at = NOW()
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_metrics
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION update_user_metrics();

DROP TRIGGER IF EXISTS trigger_update_user_metrics_on_status ON orders;

CREATE TRIGGER trigger_update_user_metrics_on_status
AFTER UPDATE OF order_status ON orders
FOR EACH ROW
WHEN (OLD.order_status IS DISTINCT FROM NEW.order_status AND NEW.order_status = 'completed')
EXECUTE FUNCTION update_user_metrics();


-- ========================================
-- SECTION 7: ADD MISSING INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(user_email));
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(user_number);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(order_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, order_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_merchant ON order_items(merchant_id) WHERE merchant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_item_extras_item ON order_item_extras(order_item_id);
CREATE INDEX IF NOT EXISTS idx_discounts_user_active ON discounts(user_id, is_active, expires_at) WHERE is_active = TRUE;


-- ========================================
-- SECTION 8: DATA VALIDATION CONSTRAINTS
-- ========================================
ALTER TABLE product
ADD COLUMN IF NOT EXISTS photo_public_id TEXT;

ALTER TABLE merchant
ADD COLuMN IF NOT EXISTS photo_public_id TEXT;
ALTER TABLE product ADD COLUMN IF NOT EXISTS category_id INTEGER;

ALTER TABLE merchant ADD COLUMN IF NOT EXISTS photo_public_id TEXT;
-- Add foreign key
ALTER TABLE product ADD CONSTRAINT fk_product_category 
  FOREIGN KEY (category_id) REFERENCES category(category_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_price_positive') THEN
        ALTER TABLE product ADD CONSTRAINT product_price_positive CHECK (product_price >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merchant_price_positive') THEN
        ALTER TABLE merchant ADD CONSTRAINT merchant_price_positive CHECK (merchant_price >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'extras_price_positive') THEN
        ALTER TABLE extras ADD CONSTRAINT extras_price_positive CHECK (extra_price >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_total_positive') THEN
        ALTER TABLE orders ADD CONSTRAINT orders_total_positive CHECK (total_price >= 0);
    END IF;
END $$;


-- ========================================
-- SECTION 9: FIX GET_USER_FULL_DETAILS
-- ========================================

DROP FUNCTION IF EXISTS get_user_full_details(INT) CASCADE;

CREATE OR REPLACE FUNCTION get_user_full_details(p_user_id INT)
RETURNS JSON AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
        RETURN json_build_object('error', true, 'message', 'User not found');
    END IF;

    RETURN (
        SELECT json_build_object(
            'user', row_to_json(u),
            'orders_count', COALESCE(u.total_orders, 0),
            'last_order_date', u.last_purchase_date,
            'avg_order_value', COALESCE(u.avg_order_value, 0),
            'total_spent', COALESCE(u.total_spent, 0),
            'favorite_category', (
                SELECT category_name 
                FROM (
                    SELECT p.product_category AS category_name, COUNT(*) AS cnt
                    FROM order_items oi
                    JOIN product p ON oi.product_id = p.product_id
                    JOIN orders o2 ON o2.order_id = oi.order_id
                    WHERE o2.user_id = u.id AND o2.order_status = 'completed'
                    GROUP BY p.product_category
                    ORDER BY cnt DESC LIMIT 1
                ) t
            ),
            'favorite_extras', (
                SELECT COALESCE(json_agg(t.extra_name ORDER BY t.usage_count DESC), '[]'::json)
                FROM (
                    SELECT ex.extra_name, COUNT(*) AS usage_count
                    FROM order_item_extras oie
                    JOIN extras ex ON oie.extra_id = ex.extra_id
                    JOIN order_items oi ON oi.order_item_id = oie.order_item_id
                    JOIN orders o3 ON o3.order_id = oi.order_id
                    WHERE o3.user_id = u.id AND o3.order_status = 'completed'
                    GROUP BY ex.extra_name
                    ORDER BY usage_count DESC LIMIT 5
                ) t
            ),
            'recent_orders', (
                SELECT COALESCE(json_agg(o_j ORDER BY created_at DESC), '[]'::json)
                FROM (
                    SELECT json_build_object(
                        'order_id', o4.order_id,
                        'order_code', o4.order_code,
                        'total_price', o4.total_price,
                        'created_at', o4.created_at,
                        'status', o4.order_status,
                        'items', (
                            SELECT COALESCE(json_agg(json_build_object(
                                'product_name', COALESCE(p2.product_name, m2.merchant_name),
                                'quantity', oi2.quantity,
                                'unit_price', oi2.product_price,
                                'total_price', oi2.total_price
                            )), '[]'::json)
                            FROM order_items oi2
                            LEFT JOIN product p2 ON p2.product_id = oi2.product_id
                            LEFT JOIN merchant m2 ON m2.merchant_id = oi2.merchant_id
                            WHERE oi2.order_id = o4.order_id
                        )
                    ) AS o_j,
                    o4.created_at
                    FROM orders o4
                    WHERE o4.user_id = u.id
                    ORDER BY o4.created_at DESC LIMIT 5
                ) sub_orders
            ),
            'points_balance', COALESCE(u.points, 0),
            'points_redeemed', COALESCE(u.points_redeemed, 0),
            'has_points', COALESCE(u.has_points, FALSE),
            'is_frequent_visitor', COALESCE(u.is_frequent_visitor, FALSE),
            'visits_per_week', COALESCE(u.visits_per_week, 0)
        )
        FROM users u
        WHERE u.id = p_user_id
    );
END;
$$ LANGUAGE plpgsql STABLE;


-- ========================================
-- SECTION 10: VERIFY ALL FIXES
-- ========================================

DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname IN (
        'generate_order_code',
        'update_order_total',
        'calculate_discount',
        'update_user_visit_frequency',
        'update_user_metrics'
    );

    RAISE NOTICE 'Verified % critical functions present.', v_count;
END $$;

COMMIT;
