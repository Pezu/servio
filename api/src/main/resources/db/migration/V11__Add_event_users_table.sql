CREATE TABLE event_users (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, user_id)
);

CREATE INDEX idx_event_users_event_id ON event_users(event_id);
CREATE INDEX idx_event_users_user_id ON event_users(user_id);