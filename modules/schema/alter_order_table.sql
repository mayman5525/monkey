-- Add total_price and ensure order_code is TEXT
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='orders' AND column_name='total_price'
    ) THEN
        ALTER TABLE orders ADD COLUMN total_price NUMERIC DEFAULT 0.0;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='orders' AND column_name='order_code' AND data_type='numeric'
    ) THEN
        ALTER TABLE orders ALTER COLUMN order_code TYPE TEXT USING order_code::TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='orders' AND column_name='order_code'
    ) THEN
        ALTER TABLE orders ADD COLUMN order_code TEXT;
    END IF;

    -- Remove duplicate points_redeemed column if it exists
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='orders' AND column_name='points_redeemed'
    ) THEN
        -- Check for multiple columns named points_redeemed
        PERFORM 1
        FROM information_schema.columns
        WHERE table_name='orders' AND column_name='points_redeemed'
        GROUP BY column_name
        HAVING COUNT(*) > 1;

        IF FOUND THEN
            -- Drop one of the duplicate columns
            ALTER TABLE orders DROP COLUMN points_redeemed;
            ALTER TABLE orders ADD COLUMN points_redeemed INTEGER DEFAULT 0;
        END IF;
    END IF;
END $$;

-- Function to generate order_code
CREATE OR REPLACE FUNCTION generate_order_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_code := LPAD((FLOOR(RANDOM() * 10000))::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to generate order_code before insert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trigger_generate_order_code'
    ) THEN
        CREATE TRIGGER trigger_generate_order_code
        BEFORE INSERT ON orders
        FOR EACH ROW
        EXECUTE FUNCTION generate_order_code();
    END IF;
END $$;

-- Consolidated and optimized update_order_total function (incremental updates for speed; handles both tables; includes points_earned)
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
        RAISE NOTICE 'update_order_total triggered from unexpected table: %', TG_TABLE_NAME;
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    IF target_order_id IS NULL OR delta = 0 THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    UPDATE orders
    SET total_price = total_price + delta,
        points_earned = ((total_price + delta) * 10)::INTEGER,
        updated_at = NOW()
    WHERE order_id = target_order_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger for order_items insert/update/delete
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trigger_update_order_total_on_items'
    ) THEN
        CREATE TRIGGER trigger_update_order_total_on_items
        AFTER INSERT OR UPDATE OR DELETE ON order_items
        FOR EACH ROW
        EXECUTE FUNCTION update_order_total();
    END IF;
END $$;

-- Trigger for order_item_extras insert/update/delete
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trigger_update_order_total_on_extras'
    ) THEN
        CREATE TRIGGER trigger_update_order_total_on_extras
        AFTER INSERT OR UPDATE OR DELETE ON order_item_extras
        FOR EACH ROW
        EXECUTE FUNCTION update_order_total();
    END IF;
END $$;

-- Fix users table column rename to avoid duplicate column error
DO $$
BEGIN
    -- Only rename visits_ber_week if it exists and visits_per_week does not
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='users' AND column_name='visits_ber_week'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='users' AND column_name='visits_per_week'
    ) THEN
        ALTER TABLE users RENAME COLUMN visits_ber_week TO visits_per_week;
    END IF;

    -- Other users table changes (from previous alter_users_table.sql)
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='users' AND column_name='total_spent' AND data_type='integer'
    ) THEN
        ALTER TABLE users ALTER COLUMN total_spent TYPE NUMERIC USING total_spent::NUMERIC;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='users' AND column_name='avg_order_value' AND data_type='integer'
    ) THEN
        ALTER TABLE users ALTER COLUMN avg_order_value TYPE NUMERIC USING avg_order_value::NUMERIC;
    END IF;

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

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='users' AND column_name='number_of_points'
    ) THEN
        ALTER TABLE users DROP COLUMN number_of_points;
    END IF;

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

    UPDATE users
    SET has_points = TRUE
    WHERE points > 0 OR points_redeemed > 0;
END $$;