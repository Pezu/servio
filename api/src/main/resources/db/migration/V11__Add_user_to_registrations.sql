ALTER TABLE registrations
    ADD COLUMN user_id UUID REFERENCES users(id);

-- One waiter registration per (event, user). Customer registrations leave
-- user_id NULL, so the partial predicate keeps them unconstrained.
CREATE UNIQUE INDEX idx_registrations_event_user
    ON registrations(event_id, user_id)
    WHERE user_id IS NOT NULL;
