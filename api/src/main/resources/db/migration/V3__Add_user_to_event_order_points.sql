ALTER TABLE event_order_points
    ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_event_order_points_user_id ON event_order_points(user_id);
