-- =========================
-- Orders / Totals Migration
-- - ensure columns exist
-- - remove old triggers/functions (all known names)
-- - create BEFORE INSERT generate_order_code (uses sequence if needed)
-- - create robust update_order_total() and triggers for items & extras
-- =========================

-- 1) Ensure required columns exist on orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS total_price NUMERIC DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS order_code TEXT,
  ADD COLUMN IF NOT EXISTS points_earned INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_redeemed INTEGER DEFAULT 0;

-- 2) Drop any existing triggers that may conflict (cover known duplicate names)
DROP TRIGGER IF EXISTS trigger_generate_order_code ON orders;
DROP TRIGGER IF EXISTS trigger_update_order_total_items ON order_items;
DROP TRIGGER IF EXISTS trigger_update_order_total_on_items ON order_items;
DROP TRIGGER IF EXISTS trigger_update_order_total_extras ON order_item_extras;
DROP TRIGGER IF EXISTS trigger_update_order_total_on_extras ON order_item_extras;

-- 3) Drop previous functions if present
DROP FUNCTION IF EXISTS generate_order_code() CASCADE;
DROP FUNCTION IF EXISTS update_order_total() CASCADE;

-- 4) Create BEFORE INSERT generate_order_code
--    This ensures order_code is set to a unique 4-digit code
CREATE OR REPLACE FUNCTION generate_order_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code TEXT;
BEGIN
    -- Keep generating until we get a unique 4-digit code
    LOOP
        new_code := LPAD((FLOOR(RANDOM() * 10000))::TEXT, 4, '0');

        -- Check uniqueness
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM orders WHERE order_code = new_code
        );
    END LOOP;

    NEW.order_code = new_code;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5) Create robust update_order_total function (optimized for incremental updates to improve runtime speed)
--    Handles INSERT / UPDATE / DELETE fired from order_items OR order_item_extras
CREATE OR REPLACE FUNCTION update_order_total()
RETURNS TRIGGER AS $$
DECLARE
    delta NUMERIC := 0;
    target_order_id INTEGER := NULL;
BEGIN
    /*
      Resolve the affected order_id and delta depending on:
        - which table triggered this function (TG_TABLE_NAME)
        - which operation (TG_OP) — DELETE uses OLD, others use NEW
    */

    IF TG_TABLE_NAME = 'order_items' THEN
        IF TG_OP = 'DELETE' THEN
            target_order_id := OLD.order_id;
            delta := -OLD.total_price;
        ELSIF TG_OP = 'INSERT' THEN
            target_order_id := NEW.order_id;
            delta := NEW.total_price;
        ELSE  -- UPDATE
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
        ELSE  -- UPDATE
            SELECT order_id INTO target_order_id
            FROM order_items
            WHERE order_item_id = NEW.order_item_id;
            delta := NEW.extra_price - OLD.extra_price;
        END IF;

    ELSE
        -- Unexpected source table; exit gracefully
        RAISE NOTICE 'update_order_total triggered from unexpected table: %', TG_TABLE_NAME;
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- If we couldn't determine an order_id or delta is 0, return safely
    IF target_order_id IS NULL OR delta = 0 THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- Incrementally update orders totals and points
    UPDATE orders
    SET total_price = total_price + delta,
        points_earned = ((total_price + delta) * 10)::INTEGER,
        updated_at = NOW()
    WHERE order_id = target_order_id;

    -- Return appropriate record for the trigger context
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6) Recreate triggers (generate_order_code BEFORE insert; totals AFTER insert/update/delete)
CREATE TRIGGER trigger_generate_order_code
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION generate_order_code();

CREATE TRIGGER trigger_update_order_total_items
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_order_total();

CREATE TRIGGER trigger_update_order_total_extras
AFTER INSERT OR UPDATE OR DELETE ON order_item_extras
FOR EACH ROW
EXECUTE FUNCTION update_order_total();