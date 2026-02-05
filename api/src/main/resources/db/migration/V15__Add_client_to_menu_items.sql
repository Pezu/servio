-- Add client_id column to menu_items for client-level menus
ALTER TABLE menu_items ADD COLUMN client_id UUID;

-- Add foreign key constraint
ALTER TABLE menu_items ADD CONSTRAINT fk_menu_items_client
    FOREIGN KEY (client_id) REFERENCES clients(id);

-- Make location_id nullable (menu items can now belong to either a client or a location)
ALTER TABLE menu_items ALTER COLUMN location_id DROP NOT NULL;

-- Add check constraint to ensure either client_id or location_id is set (but not both)
ALTER TABLE menu_items ADD CONSTRAINT chk_menu_items_owner
    CHECK ((client_id IS NOT NULL AND location_id IS NULL) OR (client_id IS NULL AND location_id IS NOT NULL));