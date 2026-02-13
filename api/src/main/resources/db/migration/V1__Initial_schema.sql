-- =============================================
-- Client Types
-- =============================================
CREATE TABLE client_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT
);

-- =============================================
-- Clients
-- =============================================
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    logo_path VARCHAR(255),
    client_type_id UUID,
    CONSTRAINT fk_clients_client_type FOREIGN KEY (client_type_id) REFERENCES client_types(id)
);

CREATE INDEX idx_clients_email ON clients(email);

-- =============================================
-- Locations
-- =============================================
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    client_id UUID NOT NULL,
    parent_id UUID,
    CONSTRAINT fk_location_client FOREIGN KEY (client_id) REFERENCES clients(id),
    CONSTRAINT fk_locations_parent FOREIGN KEY (parent_id) REFERENCES locations(id) ON DELETE CASCADE
);

CREATE INDEX idx_locations_client_id ON locations(client_id);
CREATE INDEX idx_locations_parent_id ON locations(parent_id);

-- =============================================
-- Order Points
-- =============================================
CREATE TABLE order_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    location_id UUID NOT NULL,
    CONSTRAINT fk_order_point_location FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE INDEX idx_order_points_location_id ON order_points(location_id);

-- =============================================
-- Users
-- =============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    roles VARCHAR(32)[] NOT NULL DEFAULT '{}',
    client_id UUID NOT NULL,
    CONSTRAINT fk_user_client FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_client_id ON users(client_id);

-- =============================================
-- Roles
-- =============================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(500)
);

CREATE INDEX idx_roles_name ON roles(name);

-- =============================================
-- Payment Types
-- =============================================
CREATE TABLE payment_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(500)
);

CREATE INDEX idx_payment_types_name ON payment_types(name);

-- =============================================
-- Events
-- =============================================
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    location_id UUID NOT NULL,
    last_order_no INTEGER NOT NULL DEFAULT 0,
    logo_path VARCHAR(255),
    CONSTRAINT fk_event_location FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE INDEX idx_events_location_id ON events(location_id);

-- =============================================
-- Event Users (many-to-many)
-- =============================================
CREATE TABLE event_users (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, user_id)
);

CREATE INDEX idx_event_users_event_id ON event_users(event_id);
CREATE INDEX idx_event_users_user_id ON event_users(user_id);

-- =============================================
-- Event Payment Types (many-to-many)
-- =============================================
CREATE TABLE event_payment_types (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    payment_type_id UUID NOT NULL REFERENCES payment_types(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, payment_type_id)
);

CREATE INDEX idx_event_payment_types_event_id ON event_payment_types(event_id);
CREATE INDEX idx_event_payment_types_payment_type_id ON event_payment_types(payment_type_id);

-- =============================================
-- Registrations
-- =============================================
CREATE TABLE registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    CONSTRAINT fk_registration_event FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE INDEX idx_registrations_event_id ON registrations(event_id);

-- =============================================
-- Orders
-- =============================================
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    registration_id UUID NOT NULL,
    event_id UUID NOT NULL,
    order_point_id UUID NOT NULL,
    order_no INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL,
    assigned_user VARCHAR(50),
    note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_registration FOREIGN KEY (registration_id) REFERENCES registrations(id),
    CONSTRAINT fk_order_event FOREIGN KEY (event_id) REFERENCES events(id),
    CONSTRAINT fk_order_order_point FOREIGN KEY (order_point_id) REFERENCES order_points(id)
);

-- =============================================
-- Order Items
-- =============================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ORDERED',
    note TEXT,
    CONSTRAINT fk_order_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- =============================================
-- Menu Items
-- =============================================
CREATE TABLE menu_items (
    id UUID PRIMARY KEY,
    location_id UUID,
    client_id UUID,
    parent_id UUID,
    name VARCHAR(255) NOT NULL,
    orderable BOOLEAN NOT NULL DEFAULT true,
    price DECIMAL(10, 2),
    sort_order INTEGER NOT NULL DEFAULT 0,
    image_path VARCHAR(255),
    description VARCHAR(500),
    CONSTRAINT fk_menu_item_location FOREIGN KEY (location_id) REFERENCES locations(id),
    CONSTRAINT fk_menu_item_parent FOREIGN KEY (parent_id) REFERENCES menu_items(id),
    CONSTRAINT fk_menu_items_client FOREIGN KEY (client_id) REFERENCES clients(id),
    CONSTRAINT chk_menu_items_owner CHECK ((client_id IS NOT NULL AND location_id IS NULL) OR (client_id IS NULL AND location_id IS NOT NULL))
);

-- =============================================
-- Event Menu Items (many-to-many)
-- =============================================
CREATE TABLE event_menu_items (
    event_id UUID NOT NULL,
    menu_item_id UUID NOT NULL,
    PRIMARY KEY (event_id, menu_item_id),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

-- =============================================
-- Seed Data
-- =============================================

-- Roles
INSERT INTO roles (name, description) VALUES ('SUPER', 'Super administrator with full access');
INSERT INTO roles (name, description) VALUES ('ADMIN', 'Administrator with management access');
INSERT INTO roles (name, description) VALUES ('BAR', 'Bar staff with order processing access');

-- Payment Types
INSERT INTO payment_types (name, description) VALUES ('CASH', 'Cash payment');
INSERT INTO payment_types (name, description) VALUES ('CARD', 'Card payment at terminal');
INSERT INTO payment_types (name, description) VALUES ('WEB', 'Online web payment');
INSERT INTO payment_types (name, description) VALUES ('PENDING', 'Payment pending');

-- Client Types
INSERT INTO client_types (name, description) VALUES ('HOTEL', 'Hotel establishment');
INSERT INTO client_types (name, description) VALUES ('EVENT', 'Event organizer');
INSERT INTO client_types (name, description) VALUES ('BAR', 'Bar or restaurant');

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
