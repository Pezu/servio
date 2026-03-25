-- Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    registration_id UUID NOT NULL,
    event_id UUID NOT NULL,
    order_point_id UUID NOT NULL,
    order_no INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    assigned_user VARCHAR(50),
    note TEXT,
    needs_payment BOOLEAN NOT NULL DEFAULT FALSE,
    nickname VARCHAR(100)
);

-- Order items table
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ORDERED',
    note TEXT,
    paid BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes for common queries
CREATE INDEX idx_orders_registration_id ON orders(registration_id);
CREATE INDEX idx_orders_event_id ON orders(event_id);
CREATE INDEX idx_orders_order_point_id ON orders(order_point_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_status ON order_items(status);
CREATE INDEX idx_order_items_paid ON order_items(paid);
