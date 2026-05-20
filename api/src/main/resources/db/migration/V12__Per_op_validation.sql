CREATE TABLE registration_order_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    order_point_id UUID NOT NULL REFERENCES order_points(id),
    validation_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (registration_id, order_point_id)
);

CREATE INDEX idx_rop_registration ON registration_order_points(registration_id);
CREATE INDEX idx_rop_orderpoint_status ON registration_order_points(order_point_id, validation_status);

DROP INDEX IF EXISTS idx_registrations_event_status;
DROP INDEX IF EXISTS idx_registrations_orderpoint_status;

ALTER TABLE registrations DROP COLUMN IF EXISTS order_point_id;
ALTER TABLE registrations DROP COLUMN IF EXISTS validation_status;
ALTER TABLE registrations DROP COLUMN IF EXISTS approved_by;
ALTER TABLE registrations DROP COLUMN IF EXISTS approved_at;
