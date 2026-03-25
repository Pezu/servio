CREATE TABLE event_order_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    order_point_id UUID NOT NULL REFERENCES order_points(id) ON DELETE CASCADE,
    prepaid DECIMAL(10, 2) DEFAULT 0,
    client_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    UNIQUE(event_id, order_point_id)
);

CREATE INDEX idx_event_order_points_event_id ON event_order_points(event_id);
CREATE INDEX idx_event_order_points_order_point_id ON event_order_points(order_point_id);
