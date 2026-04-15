-- Create schemas for each microservice
CREATE SCHEMA IF NOT EXISTS event;
CREATE SCHEMA IF NOT EXISTS orders;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA event TO servio;
GRANT ALL PRIVILEGES ON SCHEMA orders TO servio;
