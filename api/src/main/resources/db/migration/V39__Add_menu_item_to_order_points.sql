ALTER TABLE order_points ADD COLUMN menu_item_id UUID;
ALTER TABLE order_points ADD CONSTRAINT fk_order_point_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL;
CREATE INDEX idx_order_points_menu_item_id ON order_points(menu_item_id);
