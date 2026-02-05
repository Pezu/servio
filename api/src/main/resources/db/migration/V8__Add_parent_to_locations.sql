-- Add parent_id column to locations table for sub-location support
ALTER TABLE locations ADD COLUMN parent_id UUID;

-- Add foreign key constraint
ALTER TABLE locations ADD CONSTRAINT fk_locations_parent
    FOREIGN KEY (parent_id) REFERENCES locations(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX idx_locations_parent_id ON locations(parent_id);