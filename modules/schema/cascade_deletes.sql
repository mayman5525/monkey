-- ========================================
-- CASCADE DELETES MIGRATION
-- Version: 1.0.0
-- Description: Update all foreign key constraints to use ON DELETE CASCADE
--              This allows deletion of records even when referenced by other tables
-- ========================================

BEGIN;

-- ========================================
-- SECTION 1: DROP EXISTING FOREIGN KEY CONSTRAINTS
-- ========================================

-- Drop foreign key constraints that need to be recreated with CASCADE
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Drop orders.user_id foreign key
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'orders'::regclass
          AND confrelid = 'users'::regclass
          AND contype = 'f'
    LOOP
        EXECUTE 'ALTER TABLE orders DROP CONSTRAINT IF EXISTS ' || constraint_record.conname;
    END LOOP;

    -- Drop product.product_category foreign key (references category by name)
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'product'::regclass
          AND confrelid = 'category'::regclass
          AND contype = 'f'
          AND conkey::text LIKE '%product_category%'
    LOOP
        EXECUTE 'ALTER TABLE product DROP CONSTRAINT IF EXISTS ' || constraint_record.conname;
    END LOOP;

    -- Drop product.category_id foreign key (references category by id)
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'product'::regclass
          AND confrelid = 'category'::regclass
          AND contype = 'f'
          AND (conname LIKE '%category_id%' OR conname LIKE '%fk_product_category%')
    LOOP
        EXECUTE 'ALTER TABLE product DROP CONSTRAINT IF EXISTS ' || constraint_record.conname;
    END LOOP;

    -- Drop order_items.order_id foreign key
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'order_items'::regclass
          AND confrelid = 'orders'::regclass
          AND contype = 'f'
    LOOP
        EXECUTE 'ALTER TABLE order_items DROP CONSTRAINT IF EXISTS ' || constraint_record.conname;
    END LOOP;

    -- Drop order_items.product_id foreign key
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'order_items'::regclass
          AND confrelid = 'product'::regclass
          AND contype = 'f'
    LOOP
        EXECUTE 'ALTER TABLE order_items DROP CONSTRAINT IF EXISTS ' || constraint_record.conname;
    END LOOP;

    -- Drop order_items.merchant_id foreign key (if merchant table exists)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'merchant') THEN
        FOR constraint_record IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'order_items'::regclass
              AND confrelid = 'merchant'::regclass
              AND contype = 'f'
        LOOP
            EXECUTE 'ALTER TABLE order_items DROP CONSTRAINT IF EXISTS ' || constraint_record.conname;
        END LOOP;
    END IF;

    -- Drop order_item_extras.order_item_id foreign key
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'order_item_extras'::regclass
          AND confrelid = 'order_items'::regclass
          AND contype = 'f'
    LOOP
        EXECUTE 'ALTER TABLE order_item_extras DROP CONSTRAINT IF EXISTS ' || constraint_record.conname;
    END LOOP;

    -- Drop order_item_extras.extra_id foreign key
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'order_item_extras'::regclass
          AND confrelid = 'extras'::regclass
          AND contype = 'f'
    LOOP
        EXECUTE 'ALTER TABLE order_item_extras DROP CONSTRAINT IF EXISTS ' || constraint_record.conname;
    END LOOP;
END $$;

-- ========================================
-- SECTION 2: RECREATE FOREIGN KEYS WITH CASCADE
-- ========================================

-- Recreate orders.user_id with CASCADE
ALTER TABLE orders
    ADD CONSTRAINT fk_orders_user_id
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Recreate product.product_category with CASCADE (if column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'product' AND column_name = 'product_category'
    ) THEN
        ALTER TABLE product
            ADD CONSTRAINT fk_product_category_name
            FOREIGN KEY (product_category) REFERENCES category(category_name) ON DELETE CASCADE;
    END IF;
END $$;

-- Recreate product.category_id with CASCADE (if column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'product' AND column_name = 'category_id'
    ) THEN
        -- Drop if exists first to avoid conflicts
        ALTER TABLE product DROP CONSTRAINT IF EXISTS fk_product_category;
        
        ALTER TABLE product
            ADD CONSTRAINT fk_product_category
            FOREIGN KEY (category_id) REFERENCES category(category_id) ON DELETE CASCADE;
    END IF;
END $$;

-- Recreate order_items.order_id with CASCADE
ALTER TABLE order_items
    ADD CONSTRAINT fk_order_items_order_id
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE;

-- Recreate order_items.product_id with CASCADE (if column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'order_items' AND column_name = 'product_id'
    ) THEN
        ALTER TABLE order_items
            ADD CONSTRAINT fk_order_items_product_id
            FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE;
    END IF;
END $$;

-- Recreate order_items.merchant_id with CASCADE (if column and table exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'merchant')
       AND EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_name = 'order_items' AND column_name = 'merchant_id'
       ) THEN
        ALTER TABLE order_items
            ADD CONSTRAINT fk_order_items_merchant_id
            FOREIGN KEY (merchant_id) REFERENCES merchant(merchant_id) ON DELETE CASCADE;
    END IF;
END $$;

-- Recreate order_item_extras.order_item_id with CASCADE
ALTER TABLE order_item_extras
    ADD CONSTRAINT fk_order_item_extras_order_item_id
    FOREIGN KEY (order_item_id) REFERENCES order_items(order_item_id) ON DELETE CASCADE;

-- Recreate order_item_extras.extra_id with CASCADE
ALTER TABLE order_item_extras
    ADD CONSTRAINT fk_order_item_extras_extra_id
    FOREIGN KEY (extra_id) REFERENCES extras(extra_id) ON DELETE CASCADE;

-- ========================================
-- SECTION 3: VERIFY CONSTRAINTS
-- ========================================

DO $$
DECLARE
    cascade_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO cascade_count
    FROM pg_constraint
    WHERE contype = 'f'
      AND confdeltype = 'c'
      AND conrelid IN (
          'orders'::regclass,
          'product'::regclass,
          'order_items'::regclass,
          'order_item_extras'::regclass
      );

    RAISE NOTICE 'Successfully created % foreign key constraints with CASCADE delete', cascade_count;
END $$;

COMMIT;

