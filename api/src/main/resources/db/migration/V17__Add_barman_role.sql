INSERT INTO roles (name, description) VALUES ('BARMAN', 'Bar staff serving drinks at the event')
    ON CONFLICT (name) DO NOTHING;