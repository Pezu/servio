-- Create event_payment_types join table for many-to-many relationship
CREATE TABLE event_payment_types (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    payment_type_id UUID NOT NULL REFERENCES payment_types(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, payment_type_id)
);

-- Create indexes for faster lookups
CREATE INDEX idx_event_payment_types_event_id ON event_payment_types(event_id);
CREATE INDEX idx_event_payment_types_payment_type_id ON event_payment_types(payment_type_id);