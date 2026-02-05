-- Create users table
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