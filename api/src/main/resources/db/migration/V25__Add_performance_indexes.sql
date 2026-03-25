-- Performance indexes for frequently queried columns

-- Order items: Index for order lookup
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Event menu items: Index for menu item reverse lookup
CREATE INDEX IF NOT EXISTS idx_event_menu_items_menu_item ON event_menu_items(menu_item_id);

-- Orders: Composite index for event_id + status (common query pattern)
CREATE INDEX IF NOT EXISTS idx_orders_event_id_status ON orders(event_id, status);

-- Orders: Index for status column
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Menu items: Index for parent_id (tree structure queries)
CREATE INDEX IF NOT EXISTS idx_menu_items_parent_id ON menu_items(parent_id);

-- Registrations: Composite index for event_id + validation_status
CREATE INDEX IF NOT EXISTS idx_registrations_event_status ON registrations(event_id, validation_status);

-- Registrations: Composite index for order_point_id + validation_status
CREATE INDEX IF NOT EXISTS idx_registrations_orderpoint_status ON registrations(order_point_id, validation_status);

-- Orders: Index for registration lookup
CREATE INDEX IF NOT EXISTS idx_orders_registration_id ON orders(registration_id);

-- Orders: Index for created_at date range queries
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
