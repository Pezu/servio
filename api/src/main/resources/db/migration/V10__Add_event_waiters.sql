CREATE TABLE event_waiters (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, user_id)
);

CREATE INDEX idx_event_waiters_event_id ON event_waiters(event_id);
CREATE INDEX idx_event_waiters_user_id ON event_waiters(user_id);
