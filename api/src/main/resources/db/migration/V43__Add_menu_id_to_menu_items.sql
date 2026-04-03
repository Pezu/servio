ALTER TABLE menu_items ADD COLUMN menu_id UUID;
ALTER TABLE menu_items ADD CONSTRAINT fk_menu_item_menu FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE;
CREATE INDEX idx_menu_items_menu_id ON menu_items(menu_id);
