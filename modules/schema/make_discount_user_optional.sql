-- Make user_id nullable in discounts table
ALTER TABLE discounts 
ALTER COLUMN user_id DROP NOT NULL;
