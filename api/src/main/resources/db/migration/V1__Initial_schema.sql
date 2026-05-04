-- =============================================
-- Client Types
-- =============================================
CREATE TABLE client_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT true
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
-- Menus
-- =============================================
CREATE TABLE menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_menus_location_id ON menus(location_id);

-- =============================================
-- Order Points
-- =============================================
CREATE TABLE order_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    location_id UUID NOT NULL,
    pay_later BOOLEAN NOT NULL DEFAULT false,
    menu_id UUID REFERENCES menus(id) ON DELETE SET NULL,
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
    description VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_roles_name ON roles(name);

-- =============================================
-- Role Permissions
-- =============================================
CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission VARCHAR(100) NOT NULL,
    PRIMARY KEY (role_id, permission)
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);

-- =============================================
-- Payment Types
-- =============================================
CREATE TABLE payment_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_payment_types_name ON payment_types(name);

-- =============================================
-- VAT Types
-- =============================================
CREATE TABLE vat_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    value DECIMAL(5,2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_vat_types_name ON vat_types(name);
CREATE INDEX idx_vat_types_active ON vat_types(active);

-- =============================================
-- Allergens
-- =============================================
CREATE TABLE allergens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number INTEGER NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true
);

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
-- Event Order Points
-- =============================================
CREATE TABLE event_order_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    order_point_id UUID NOT NULL REFERENCES order_points(id) ON DELETE CASCADE,
    prepaid DECIMAL(10, 2) DEFAULT 0,
    client_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    credit BOOLEAN DEFAULT FALSE,
    credit_value DECIMAL(10, 2),
    UNIQUE(event_id, order_point_id)
);

CREATE INDEX idx_event_order_points_event_id ON event_order_points(event_id);
CREATE INDEX idx_event_order_points_order_point_id ON event_order_points(order_point_id);

-- =============================================
-- Customers
-- =============================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    prefix VARCHAR(10) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_customers_prefix_phone UNIQUE (prefix, phone)
);

CREATE INDEX idx_customers_prefix_phone ON customers(prefix, phone);

-- =============================================
-- Registrations
-- =============================================
CREATE TABLE registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    order_point_id UUID REFERENCES order_points(id),
    customer_id UUID REFERENCES customers(id),
    validation_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    nickname VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_registration_event FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE INDEX idx_registrations_event_id ON registrations(event_id);
CREATE INDEX idx_registrations_event_status ON registrations(event_id, validation_status);
CREATE INDEX idx_registrations_orderpoint_status ON registrations(order_point_id, validation_status);
CREATE INDEX idx_registrations_customer_id ON registrations(customer_id);

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
    needs_payment BOOLEAN NOT NULL DEFAULT false,
    nickname VARCHAR(100),
    payment_method VARCHAR(20),
    paid_by VARCHAR(100),
    paid_at TIMESTAMP,
    tip DECIMAL(19, 2) DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_registration FOREIGN KEY (registration_id) REFERENCES registrations(id),
    CONSTRAINT fk_order_event FOREIGN KEY (event_id) REFERENCES events(id),
    CONSTRAINT fk_order_order_point FOREIGN KEY (order_point_id) REFERENCES order_points(id)
);

CREATE INDEX idx_orders_event_id_status ON orders(event_id, status);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_registration_id ON orders(registration_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);

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
    paid BOOLEAN NOT NULL DEFAULT false,
    vat_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_order_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- =============================================
-- Menu Items
-- =============================================
CREATE TABLE menu_items (
    id UUID PRIMARY KEY,
    location_id UUID,
    menu_id UUID REFERENCES menus(id) ON DELETE CASCADE,
    parent_id UUID,
    name VARCHAR(255) NOT NULL,
    orderable BOOLEAN NOT NULL DEFAULT true,
    price DECIMAL(10, 2),
    sort_order INTEGER NOT NULL DEFAULT 0,
    image_path VARCHAR(255),
    description VARCHAR(500),
    vat_type_id UUID REFERENCES vat_types(id),
    CONSTRAINT fk_menu_item_location FOREIGN KEY (location_id) REFERENCES locations(id),
    CONSTRAINT fk_menu_item_parent FOREIGN KEY (parent_id) REFERENCES menu_items(id)
);

CREATE INDEX idx_menu_items_parent_id ON menu_items(parent_id);
CREATE INDEX idx_menu_items_menu_id ON menu_items(menu_id);
CREATE INDEX idx_menu_items_vat_type_id ON menu_items(vat_type_id);

-- =============================================
-- Menu Item Allergens (many-to-many)
-- =============================================
CREATE TABLE menu_item_allergens (
    menu_item_id UUID NOT NULL,
    allergen_id UUID NOT NULL,
    PRIMARY KEY (menu_item_id, allergen_id),
    CONSTRAINT fk_menu_item_allergens_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_menu_item_allergens_allergen FOREIGN KEY (allergen_id) REFERENCES allergens(id) ON DELETE CASCADE
);

CREATE INDEX idx_menu_item_allergens_menu_item ON menu_item_allergens(menu_item_id);
CREATE INDEX idx_menu_item_allergens_allergen ON menu_item_allergens(allergen_id);

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

CREATE INDEX idx_event_menu_items_menu_item ON event_menu_items(menu_item_id);

-- =============================================
-- Cash Registers
-- =============================================
CREATE TABLE cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    uuid VARCHAR(100),
    name VARCHAR(255),
    ip VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cash_registers_event_id ON cash_registers(event_id);

-- =============================================
-- Functions
-- =============================================

-- Function to atomically increment and return order number
CREATE OR REPLACE FUNCTION increment_order_no(event_id UUID)
RETURNS INTEGER AS $$
DECLARE
    new_order_no INTEGER;
BEGIN
    UPDATE events
    SET last_order_no = last_order_no + 1
    WHERE id = event_id
    RETURNING last_order_no INTO new_order_no;

    RETURN new_order_no;
END;
$$ LANGUAGE plpgsql;