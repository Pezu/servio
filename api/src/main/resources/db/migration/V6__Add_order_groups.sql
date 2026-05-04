-- Order groups: a table-level concept that holds a set of orders placed together.
-- Orders only join an existing group when they are created and there is already
-- an ACTIVE order at the same order point. Once an order leaves ACTIVE the group
-- is "frozen" and any subsequent order at the same order point starts a new group.
CREATE TABLE order_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_point_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_groups_order_point ON order_groups(order_point_id);

ALTER TABLE orders ADD COLUMN group_id UUID;

-- Backfill: every existing order becomes its own group (by reusing the order id
-- as the group id). Historical data is never merged; only orders created after
-- this migration can join an existing ACTIVE group.
INSERT INTO order_groups (id, order_point_id, created_at)
SELECT id, order_point_id, created_at FROM orders;

UPDATE orders SET group_id = id;

ALTER TABLE orders ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE orders ADD CONSTRAINT fk_orders_group FOREIGN KEY (group_id) REFERENCES order_groups(id);
CREATE INDEX idx_orders_group ON orders(group_id);
