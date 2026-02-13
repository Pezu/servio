ALTER TABLE registrations ADD COLUMN order_point_id UUID REFERENCES order_points(id);
ALTER TABLE registrations ADD COLUMN validation_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED';
ALTER TABLE registrations ADD COLUMN approved_by VARCHAR(255);
ALTER TABLE registrations ADD COLUMN approved_at TIMESTAMP;
ALTER TABLE registrations ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
