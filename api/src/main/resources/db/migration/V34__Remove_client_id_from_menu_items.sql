-- Remove client-level menu items (menus should only be at location level)
DELETE FROM menu_items WHERE client_id IS NOT NULL AND location_id IS NULL;

-- Drop the client_id column from menu_items
ALTER TABLE menu_items DROP COLUMN IF EXISTS client_id;
