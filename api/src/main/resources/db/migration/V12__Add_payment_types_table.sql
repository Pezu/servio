-- Create payment_types table
CREATE TABLE payment_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(500)
);

-- Create index on name for faster lookups
CREATE INDEX idx_payment_types_name ON payment_types(name);