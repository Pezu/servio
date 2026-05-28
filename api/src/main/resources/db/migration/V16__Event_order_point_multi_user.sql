-- Per-OP user assignment becomes many-to-many. The single user_id column on
-- event_order_points is migrated into a join table and dropped.
CREATE TABLE event_order_point_users (
    event_order_point_id UUID NOT NULL REFERENCES event_order_points(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (event_order_point_id, user_id)
);

CREATE INDEX idx_eopu_user_id ON event_order_point_users(user_id);

INSERT INTO event_order_point_users (event_order_point_id, user_id)
SELECT id, user_id FROM event_order_points WHERE user_id IS NOT NULL;

DROP INDEX IF EXISTS idx_event_order_points_user_id;
ALTER TABLE event_order_points DROP COLUMN user_id;