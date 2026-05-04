-- =============================================
-- Seed Data
-- =============================================

-- Roles
INSERT INTO roles (name, description) VALUES ('SUPER', 'Super administrator with full access');
INSERT INTO roles (name, description) VALUES ('ADMIN', 'Administrator with management access');
INSERT INTO roles (name, description) VALUES ('SERVICE', 'Service staff with order processing access');

-- Payment Types
INSERT INTO payment_types (name, description) VALUES ('CASH', 'Cash payment');
INSERT INTO payment_types (name, description) VALUES ('CARD', 'Card payment at terminal');
INSERT INTO payment_types (name, description) VALUES ('WEB', 'Online web payment');
INSERT INTO payment_types (name, description) VALUES ('PENDING', 'Payment pending');

-- Client Types
INSERT INTO client_types (name, description) VALUES ('HOTEL', 'Hotel establishment');
INSERT INTO client_types (name, description) VALUES ('EVENT', 'Event organizer');
INSERT INTO client_types (name, description) VALUES ('BAR', 'Bar or restaurant');

-- VAT Types
INSERT INTO vat_types (name, value) VALUES ('0%', 0);
INSERT INTO vat_types (name, value) VALUES ('11%', 11);
INSERT INTO vat_types (name, value) VALUES ('21%', 21);

-- System Client
INSERT INTO clients (id, name, email, phone, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'System', 'system@tapello.com', '', 'ACTIVE');

-- Admin user with password: Cinci_55!!
INSERT INTO users (id, username, password, name, roles, client_id)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'admin',
    '$2a$10$W/1OlyjaUZzfyDA3E4xlTuz5ygSIb5QH1zLen1SluzXNf6CpZrOoi',
    'Administrator',
    ARRAY['SUPER'],
    '00000000-0000-0000-0000-000000000001'
);