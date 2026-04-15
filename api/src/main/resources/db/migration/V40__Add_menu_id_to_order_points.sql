-- Add menu_id column to order_points table
ALTER TABLE order_points ADD COLUMN menu_id UUID REFERENCES menus(id) ON DELETE SET NULL;
