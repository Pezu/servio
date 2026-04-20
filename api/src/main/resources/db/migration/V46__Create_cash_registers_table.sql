CREATE TABLE cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE
);
CREATE INDEX idx_cash_registers_event_id ON cash_registers(event_id);
