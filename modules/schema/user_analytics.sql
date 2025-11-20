-- =========================
-- Orders / Totals / Users Fixes
-- =========================

-- Ensure required columns on orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS total_price NUMERIC DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS order_code TEXT,
  ADD COLUMN IF NOT EXISTS points_earned INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_redeemed INTEGER DEFAULT 0;

-- Drop old conflicting triggers/functions
DROP TRIGGER IF EXISTS trigger_generate_order_code ON orders;
DROP TRIGGER IF EXISTS trigger_update_order_total_items ON order_items;
DROP TRIGGER IF EXISTS trigger_update_order_total_on_items ON order_items;
DROP TRIGGER IF EXISTS trigger_update_order_total_extras ON order_item_extras;
DROP TRIGGER IF EXISTS trigger_update_order_total_on_extras ON order_item_extras;

DROP FUNCTION IF EXISTS generate_order_code() CASCADE;
DROP FUNCTION IF EXISTS update_order_total() CASCADE;
DROP FUNCTION IF EXISTS update_user_metrics() CASCADE;
DROP FUNCTION IF EXISTS get_user_full_details(INT) CASCADE;

-- =========================
-- Generate unique order_code
-- =========================
CREATE OR REPLACE FUNCTION generate_order_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code TEXT;
BEGIN
    LOOP
        new_code := LPAD((FLOOR(RANDOM() * 10000))::TEXT, 4, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE order_code = new_code);
    END LOOP;

    NEW.order_code := new_code;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_order_code
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION generate_order_code();

-- =========================
-- Update order total trigger function
-- =========================
CREATE OR REPLACE FUNCTION update_order_total()
RETURNS TRIGGER AS $$
DECLARE
    delta NUMERIC := 0;
    target_order_id INTEGER := NULL;
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
            SELECT order_id INTO target_order_id FROM order_items WHERE order_item_id = OLD.order_item_id;
            delta := -OLD.extra_price;
        ELSIF TG_OP = 'INSERT' THEN
            SELECT order_id INTO target_order_id FROM order_items WHERE order_item_id = NEW.order_item_id;
            delta := NEW.extra_price;
        ELSE
            SELECT order_id INTO target_order_id FROM order_items WHERE order_item_id = NEW.order_item_id;
            delta := NEW.extra_price - OLD.extra_price;
        END IF;
    ELSE
        RAISE NOTICE 'Unexpected table: %', TG_TABLE_NAME;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;

    IF target_order_id IS NOT NULL AND delta <> 0 THEN
        UPDATE orders
        SET total_price = total_price + delta,
            points_earned = ((total_price + delta) * 10)::INTEGER,
            updated_at = NOW()
        WHERE order_id = target_order_id;
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
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

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_cashier BOOLEAN DEFAULT FALSE;


-- =========================
-- Update user metrics trigger
-- =========================
CREATE OR REPLACE FUNCTION update_user_metrics()
RETURNS TRIGGER AS $$
DECLARE
    total_count INTEGER;
    total_spend NUMERIC;
    new_points INTEGER;
BEGIN
    total_count := (SELECT COUNT(*) FROM orders WHERE user_id = NEW.user_id);
    total_spend := (SELECT COALESCE(SUM(oi.total_price),0) + COALESCE(SUM(oie.extra_price),0)
                    FROM orders o
                    LEFT JOIN order_items oi ON o.order_id = oi.order_id
                    LEFT JOIN order_item_extras oie ON oi.order_item_id = oie.order_item_id
                    WHERE o.user_id = NEW.user_id);
    new_points := ((SELECT COALESCE(SUM(oi.total_price),0) + COALESCE(SUM(oie.extra_price),0)
                    FROM order_items oi
                    LEFT JOIN order_item_extras oie ON oi.order_item_id = oie.order_item_id
                    WHERE oi.order_id = NEW.order_id) * 10)::INTEGER;

    UPDATE users
    SET total_orders = total_count,
        total_spent = total_spend,
        avg_order_value = CASE WHEN total_count>0 THEN total_spend/total_count ELSE 0 END,
        last_purchase_date = NOW(),
        points = points + new_points,
        has_points = TRUE,
        updated_at = NOW()
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_metrics
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION update_user_metrics();

-- =========================
-- Get user full details function
-- =========================
CREATE OR REPLACE FUNCTION get_user_full_details(p_user_id INT)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'user', row_to_json(u),
      'orders_count', COALESCE(u.total_orders,0),
      'last_order_date', u.last_purchase_date,
      'avg_order_value', COALESCE(u.avg_order_value,0),
      'total_spent', COALESCE(u.total_spent,0),
      'favorite_category', (
        SELECT category_name FROM (
          SELECT p.product_category AS category_name, COUNT(*) AS cnt
          FROM order_items oi
          JOIN product p ON oi.product_id = p.product_id
          JOIN orders o2 ON o2.order_id = oi.order_id
          WHERE o2.user_id = u.id
          GROUP BY p.product_category
          ORDER BY cnt DESC
          LIMIT 1
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
          WHERE o3.user_id = u.id
          GROUP BY ex.extra_name
        ) t
      ),
      'recent_orders', (
        SELECT COALESCE(json_agg(o_j ORDER BY (o_j->>'created_at')::timestamptz DESC), '[]'::json)
        FROM (
          SELECT json_build_object(
            'order_id', o4.order_id,
            'order_code', o4.order_code,
            'total_price', o4.total_price,
            'created_at', o4.created_at,
            'status', o4.order_status,
            'items', (
              SELECT COALESCE(json_agg(json_build_object(
                'product_name', p2.product_name,
                'quantity', oi2.quantity,
                'unit_price', oi2.product_price,
                'total_price', oi2.total_price
              )), '[]'::json)
              FROM order_items oi2
              JOIN product p2 ON p2.product_id = oi2.product_id
              WHERE oi2.order_id = o4.order_id
            )
          ) AS o_j
          FROM orders o4
          WHERE o4.user_id = u.id
          ORDER BY o4.created_at DESC
          LIMIT 2
        ) sub_orders
      ),
      'points_balance', COALESCE(u.points,0),
      'points_redeemed', COALESCE(u.points_redeemed,0),
      'has_points', COALESCE(u.has_points,FALSE)
    )
    FROM users u
    WHERE u.id = p_user_id
  );
END;
$$ LANGUAGE plpgsql;
