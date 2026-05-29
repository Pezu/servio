-- Where the order is served from. For non-pay-later OPs (bars), same as
-- order_point_id; for pay-later OPs (tables), the linked bar configured on
-- the event_order_points row. NULL when a pay-later table has no bar set.
ALTER TABLE orders
    ADD COLUMN service_order_point_id UUID REFERENCES order_points(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_service_order_point_id ON orders(service_order_point_id);