-- Rename BAR role to SERVICE
UPDATE roles SET name = 'SERVICE', description = 'Service staff with order processing access' WHERE name = 'BAR';
