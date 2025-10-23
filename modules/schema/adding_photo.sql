-- Migration: Add photo storage to product and merchant tables

-- Add photo columns to product table
DO $$
BEGIN
    -- Add photo_data column (stores base64 encoded image)
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='product' AND column_name='photo_data'
    ) THEN
        ALTER TABLE product ADD COLUMN photo_data TEXT;
    END IF;

    -- Add photo_mime_type column (stores image type)
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='product' AND column_name='photo_mime_type'
    ) THEN
        ALTER TABLE product ADD COLUMN photo_mime_type TEXT;
    END IF;
END $$;

-- Add photo columns to merchant table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='merchant' AND column_name='photo_data'
    ) THEN
        ALTER TABLE merchant ADD COLUMN photo_data TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='merchant' AND column_name='photo_mime_type'
    ) THEN
        ALTER TABLE merchant ADD COLUMN photo_mime_type TEXT;
    END IF;

    -- Add merchant_photo column for compatibility
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='merchant' AND column_name='merchant_photo'
    ) THEN
        ALTER TABLE merchant ADD COLUMN merchant_photo TEXT;
    END IF;
END $$;