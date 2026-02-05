-- Create client_types table
CREATE TABLE client_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT
);

-- Add client_type_id to clients table
ALTER TABLE clients ADD COLUMN client_type_id UUID;
ALTER TABLE clients ADD CONSTRAINT fk_clients_client_type FOREIGN KEY (client_type_id) REFERENCES client_types(id);