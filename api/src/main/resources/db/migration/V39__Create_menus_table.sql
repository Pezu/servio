-- Create menus table
CREATE TABLE menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups by location
CREATE INDEX idx_menus_location_id ON menus(location_id);

-- Add menu_id to menu_items (nullable initially for migration)
ALTER TABLE menu_items ADD COLUMN menu_id UUID REFERENCES menus(id) ON DELETE CASCADE;

-- Create default menu for each location that has menu items
INSERT INTO menus (id, location_id, name)
SELECT DISTINCT gen_random_uuid(), location_id, 'Default Menu'
FROM menu_items
WHERE location_id IS NOT NULL;

-- Update menu_items to reference the newly created menus
UPDATE menu_items mi
SET menu_id = (
    SELECT m.id FROM menus m WHERE m.location_id = mi.location_id LIMIT 1
)
WHERE mi.location_id IS NOT NULL;

-- Create index for menu_items by menu
CREATE INDEX idx_menu_items_menu_id ON menu_items(menu_id);
