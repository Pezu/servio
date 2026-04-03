CREATE TABLE order_point_menus (
    order_point_id UUID NOT NULL REFERENCES order_points(id) ON DELETE CASCADE,
    menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    PRIMARY KEY (order_point_id, menu_id)
);
CREATE INDEX idx_order_point_menus_order_point_id ON order_point_menus(order_point_id);
CREATE INDEX idx_order_point_menus_menu_id ON order_point_menus(menu_id);
