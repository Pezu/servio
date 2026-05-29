-- Pay-later rows can reference a non-pay-later sibling (typically a bar)
-- to route drinks through. NULL for non-pay-later rows.
ALTER TABLE event_order_points
    ADD COLUMN linked_order_point_id UUID REFERENCES order_points(id) ON DELETE SET NULL;

CREATE INDEX idx_event_order_points_linked_order_point_id
    ON event_order_points(linked_order_point_id);