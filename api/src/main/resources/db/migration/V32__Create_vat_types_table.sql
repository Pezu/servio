CREATE TABLE vat_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    value DECIMAL(5,2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_vat_types_name ON vat_types(name);
CREATE INDEX idx_vat_types_active ON vat_types(active);

-- Seed VAT types
INSERT INTO vat_types (name, value) VALUES ('0%', 0);
INSERT INTO vat_types (name, value) VALUES ('11%', 11);
INSERT INTO vat_types (name, value) VALUES ('21%', 21);