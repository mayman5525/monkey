BEGIN;

-- 1️⃣  Create or update discounts table
CREATE TABLE IF NOT EXISTS discounts (
    discount_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value >= 0 AND discount_value <= 100000),
    discount_code TEXT,
    discount_description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NULL,
    used_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discounts_user_id
    ON discounts(user_id)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_discounts_expiry
    ON discounts(expires_at)
    WHERE expires_at IS NOT NULL AND is_active = TRUE;

-- 2️⃣  Alter existing tables safely
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS applied_discount NUMERIC(10, 2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS discount_id INTEGER REFERENCES discounts(discount_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS total_price NUMERIC(12,2) DEFAULT 0.0;

CREATE INDEX IF NOT EXISTS idx_orders_discount_id
    ON orders(discount_id)
    WHERE applied_discount > 0;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_frequent_visitor BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS visits_per_week NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_visit TIMESTAMP;

-- 3️⃣  Function: Update user visit frequency
-- Triggered AFTER UPDATE OF order_status on orders when it transitions to 'completed'
CREATE OR REPLACE FUNCTION update_user_visit_frequency()
RETURNS TRIGGER AS $$
DECLARE
    v_visits_60d INTEGER;
    v_visits_14d INTEGER;
    v_first_completed TIMESTAMP;
    v_weeks_active NUMERIC;
    v_visits_per_week NUMERIC;
BEGIN
    -- Only process transitions TO 'completed'
    IF NEW.order_status <> 'completed' OR OLD.order_status = 'completed' THEN
        RETURN NEW;
    END IF;

    -- Count completed orders in last 60 days
    SELECT COUNT(*) INTO v_visits_60d
    FROM orders
    WHERE user_id = NEW.user_id
      AND order_status = 'completed'
      AND created_at >= NOW() - INTERVAL '60 days';

    -- Count completed orders in last 14 days
    SELECT COUNT(*) INTO v_visits_14d
    FROM orders
    WHERE user_id = NEW.user_id
      AND order_status = 'completed'
      AND created_at >= NOW() - INTERVAL '14 days';

    -- First completed order timestamp for this user (to compute active weeks)
    SELECT MIN(created_at) INTO v_first_completed
    FROM orders
    WHERE user_id = NEW.user_id
      AND order_status = 'completed';

    IF v_first_completed IS NULL THEN
        v_weeks_active := 1;
    ELSE
        v_weeks_active := GREATEST(EXTRACT(EPOCH FROM (NOW() - v_first_completed)) / 604800.0, 1);
    END IF;

    -- Compute visits per week over 60-day window (use at most ~8.57 weeks)
    v_visits_per_week := CASE
        WHEN v_weeks_active > 0 THEN v_visits_60d::NUMERIC / LEAST(v_weeks_active, 8.57)
        ELSE 0
    END;

    -- Update user metrics
    UPDATE users
    SET
        last_visit = NOW(),
        visits_per_week = ROUND(v_visits_per_week::NUMERIC, 2),
        is_frequent_visitor = (v_visits_per_week >= 1 OR v_visits_14d >= 2),
        updated_at = NOW()
    WHERE id = NEW.user_id;

    RAISE NOTICE 'Updated visit frequency for user_id=%, visits_60d=%, visits_14d=%, visits_per_week=%',
        NEW.user_id, v_visits_60d, v_visits_14d, v_visits_per_week;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4️⃣  Function: Calculate discount on confirmation
-- Triggered BEFORE UPDATE OF order_status on orders when it transitions to 'confirmed'
CREATE OR REPLACE FUNCTION calculate_discount()
RETURNS TRIGGER AS $$
DECLARE
    v_discount_record RECORD;
    v_new_total NUMERIC;
BEGIN
    -- Only process transitions TO 'confirmed'
    IF NEW.order_status <> 'confirmed' OR OLD.order_status = 'confirmed' THEN
        RETURN NEW;
    END IF;

    -- Lock the selected discount row to avoid race conditions
    SELECT discount_id, discount_value
    INTO v_discount_record
    FROM discounts
    WHERE user_id = NEW.user_id
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE;

    IF v_discount_record IS NOT NULL THEN
        v_new_total := GREATEST(COALESCE(NEW.total_price, 0) - v_discount_record.discount_value, 0);

        -- Apply discount to order
        NEW.applied_discount := v_discount_record.discount_value;
        NEW.discount_id := v_discount_record.discount_id;
        NEW.total_price := ROUND(v_new_total::NUMERIC, 2);
        NEW.updated_at := NOW();

        -- Mark discount as used
        UPDATE discounts
        SET is_active = FALSE,
            used_at = NOW(),
            updated_at = NOW()
        WHERE discount_id = v_discount_record.discount_id;

        RAISE NOTICE 'Discount applied: user_id=%, discount_id=%, value=%, new_total=%',
            NEW.user_id, v_discount_record.discount_id, v_discount_record.discount_value, NEW.total_price;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5️⃣  JSON function: Potential clients
CREATE OR REPLACE FUNCTION get_potential_clients()
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT COALESCE(json_agg(json_build_object(
            'form_id', f.id,
            'name', f.name,
            'email', f.email,
            'phone_number', f.phone_number,
            'form_submitted_at', f.created_at,
            'messages', f.messages,
            'days_since_form', EXTRACT(DAY FROM NOW() - f.created_at)::INTEGER
        ) ORDER BY f.created_at DESC), '[]'::json)
        FROM forms f
        LEFT JOIN users u ON (u.user_email = f.email OR u.user_number = f.phone_number::TEXT)
        LEFT JOIN orders o ON o.user_id = u.id
        WHERE u.id IS NULL OR NOT EXISTS (SELECT 1 FROM orders o2 WHERE o2.user_id = u.id)
    );
END;
$$ LANGUAGE plpgsql;

-- 6️⃣  JSON function: Extended user analytics
CREATE OR REPLACE FUNCTION get_user_analytics(p_user_id INT)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_build_object(
            'user_id', u.id,
            'user_name', u.user_name,
            'email', u.user_email,
            'phone', u.user_number,
            'total_orders', COALESCE(u.total_orders, (SELECT COUNT(*) FROM orders WHERE user_id = u.id)),
            'total_spent', COALESCE(u.total_spent, (SELECT COALESCE(SUM(o.total_price),0) FROM orders o WHERE o.user_id = u.id)),
            'avg_order_value', COALESCE(u.avg_order_value, 0),
            'is_frequent_visitor', COALESCE(u.is_frequent_visitor, FALSE),
            'visits_per_week', COALESCE(u.visits_per_week, 0),
            'last_visit', u.last_visit,
            'available_discounts', (
                SELECT COALESCE(json_agg(json_build_object(
                    'discount_id', d.discount_id,
                    'code', d.discount_code,
                    'value', d.discount_value,
                    'expires_at', d.expires_at,
                    'is_expired', d.expires_at IS NOT NULL AND d.expires_at <= NOW()
                )), '[]'::json)
                FROM discounts d
                WHERE d.user_id = u.id
                  AND d.is_active = TRUE
                  AND (d.expires_at IS NULL OR d.expires_at > NOW())
            ),
            'recent_orders', (
                SELECT COALESCE(json_agg(json_build_object(
                    'order_id', o.order_id,
                    'order_code', o.order_code,
                    'status', o.order_status,
                    'total_price', o.total_price,
                    'applied_discount', COALESCE(o.applied_discount, 0),
                    'points_earned', COALESCE(o.points_earned, 0),
                    'created_at', o.created_at
                ) ORDER BY o.created_at DESC), '[]'::json)
                FROM orders o
                WHERE o.user_id = u.id
                LIMIT 5
            )
        )
        FROM users u
        WHERE u.id = p_user_id
    );
END;
$$ LANGUAGE plpgsql;

-- 7️⃣  Functions to create discounts
CREATE OR REPLACE FUNCTION create_user_discount(p_user_id INT, p_discount_code TEXT, p_discount_value NUMERIC, p_description TEXT DEFAULT NULL, p_expires_at TIMESTAMP DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    v_new_discount_id INT;
BEGIN
    INSERT INTO discounts (user_id, discount_code, discount_value, discount_description, expires_at)
    VALUES (p_user_id, p_discount_code, p_discount_value, p_description, p_expires_at)
    RETURNING discount_id INTO v_new_discount_id;

    RETURN json_build_object(
        'status', 'success',
        'discount_id', v_new_discount_id,
        'user_id', p_user_id,
        'discount_value', p_discount_value
    );
EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('status', 'error', 'message', 'Discount code already exists');
WHEN OTHERS THEN
    RETURN json_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION bulk_create_frequent_visitor_discounts(p_discount_value NUMERIC, p_expires_at TIMESTAMP DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    v_created_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
    v_user RECORD;
BEGIN
    FOR v_user IN 
        SELECT id
        FROM users
        WHERE is_frequent_visitor = TRUE
    LOOP
        BEGIN
            PERFORM create_user_discount(v_user.id, 'LOYAL_' || v_user.id || '_' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'), p_discount_value, 'Frequent visitor', p_expires_at);
            v_created_count := v_created_count + 1;
        EXCEPTION WHEN unique_violation THEN
            v_skipped_count := v_skipped_count + 1;
        END;
    END LOOP;

    RETURN json_build_object(
        'created', v_created_count,
        'skipped', v_skipped_count,
        'message', v_created_count || ' discounts created for frequent visitors'
    );
END;
$$ LANGUAGE plpgsql;

-- 8️⃣  Views for analytics
CREATE OR REPLACE VIEW frequent_visitors_summary AS
SELECT
    u.id AS user_id,
    u.user_name,
    u.user_email,
    u.visits_per_week,
    u.is_frequent_visitor,
    COALESCE(COUNT(o.order_id), 0) AS total_orders,
    COALESCE(SUM(o.total_price), 0) AS total_spent,
    COUNT(DISTINCT d.discount_id) FILTER (WHERE d.is_active = TRUE) AS active_discounts_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
LEFT JOIN discounts d ON d.user_id = u.id AND d.is_active = TRUE
WHERE u.is_frequent_visitor = TRUE
GROUP BY u.id, u.user_name, u.user_email, u.visits_per_week, u.is_frequent_visitor
ORDER BY u.visits_per_week DESC;

CREATE OR REPLACE VIEW discount_usage_stats AS
SELECT
    d.discount_id,
    d.discount_code,
    d.discount_value,
    d.created_at,
    d.used_at,
    d.is_active,
    u.user_name,
    u.user_email,
    CASE
        WHEN d.used_at IS NOT NULL THEN 'Used'
        WHEN d.expires_at IS NOT NULL AND d.expires_at <= NOW() THEN 'Expired'
        ELSE 'Active'
    END AS status,
    (d.expires_at - NOW()) AS time_until_expiry
FROM discounts d
LEFT JOIN users u ON d.user_id = u.id
ORDER BY d.created_at DESC;

CREATE OR REPLACE VIEW potential_clients_summary AS
SELECT
    f.id AS form_id,
    f.name,
    f.email,
    f.phone_number,
    f.created_at AS form_submitted_at,
    EXTRACT(DAY FROM NOW() - f.created_at) AS days_since_submission
FROM forms f
LEFT JOIN users u ON (u.user_email = f.email OR u.user_number = f.phone_number::TEXT)
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY f.id, f.name, f.email, f.phone_number, f.created_at
HAVING COUNT(o.order_id) = 0
ORDER BY f.created_at DESC;

-- 9️⃣  Triggers (use order_status column)
DROP TRIGGER IF EXISTS trg_update_user_visit_frequency ON orders;
CREATE TRIGGER trg_update_user_visit_frequency
AFTER UPDATE OF order_status ON orders
FOR EACH ROW
WHEN (OLD.order_status IS DISTINCT FROM NEW.order_status)
EXECUTE FUNCTION update_user_visit_frequency();

DROP TRIGGER IF EXISTS trg_calculate_discount ON orders;
CREATE TRIGGER trg_calculate_discount
BEFORE UPDATE OF order_status ON orders
FOR EACH ROW
WHEN (OLD.order_status IS DISTINCT FROM NEW.order_status)
EXECUTE FUNCTION calculate_discount();

-- 🔟  Optimize planner stats
ANALYZE discounts;
ANALYZE orders;
ANALYZE users;

COMMIT;
