-- Create clients table
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE INDEX idx_clients_email ON clients(email);

-- Create locations table
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    client_id UUID NOT NULL,
    CONSTRAINT fk_location_client FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE INDEX idx_locations_client_id ON locations(client_id);

-- Create order_points table
CREATE TABLE order_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    location_id UUID NOT NULL,
    CONSTRAINT fk_order_point_location FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE INDEX idx_order_points_location_id ON order_points(location_id);

-- Create events table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    location_id UUID NOT NULL,
    last_order_no INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT fk_event_location FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE INDEX idx_events_location_id ON events(location_id);

-- Create registrations table
CREATE TABLE registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    CONSTRAINT fk_registration_event FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE INDEX idx_registrations_event_id ON registrations(event_id);

-- Create orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    registration_id UUID NOT NULL,
    event_id UUID NOT NULL,
    order_point_id UUID NOT NULL,
    order_no INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL,
    assigned_user VARCHAR(50),
    note TEXT,
    CONSTRAINT fk_order_registration FOREIGN KEY (registration_id) REFERENCES registrations(id),
    CONSTRAINT fk_order_event FOREIGN KEY (event_id) REFERENCES events(id),
    CONSTRAINT fk_order_order_point FOREIGN KEY (order_point_id) REFERENCES order_points(id)
);

-- Create order_items table
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

-- Create menu_items table
CREATE TABLE menu_items (
    id UUID PRIMARY KEY,
    location_id UUID NOT NULL,
    parent_id UUID,
    name VARCHAR(255) NOT NULL,
    orderable BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT fk_menu_item_location FOREIGN KEY (location_id) REFERENCES locations(id),
    CONSTRAINT fk_menu_item_parent FOREIGN KEY (parent_id) REFERENCES menu_items(id)
);