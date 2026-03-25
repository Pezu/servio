-- Create role_permissions table for storing role permissions
CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission VARCHAR(100) NOT NULL,
    PRIMARY KEY (role_id, permission)
);

-- Create index for faster lookups
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
