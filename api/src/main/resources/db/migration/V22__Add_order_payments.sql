-- One row per payment transaction against an order. Full pay → one row;
-- partial pay (from the app) → one row per installment. Lets the revenue
-- report break an order down into how much was paid in each payment, and how.
CREATE TABLE order_payments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount         NUMERIC(19, 2) NOT NULL,
    payment_method VARCHAR(20),
    paid_by        VARCHAR(100),
    paid_at        TIMESTAMP NOT NULL
);

CREATE INDEX idx_order_payments_order_id ON order_payments(order_id);

-- Backfill: orders already settled before this feature had a single payment
-- covering all their non-cancelled items.
INSERT INTO order_payments (order_id, amount, payment_method, paid_by, paid_at)
SELECT o.id,
       COALESCE((SELECT SUM(oi.price * oi.quantity)
                 FROM order_items oi
                 WHERE oi.order_id = o.id AND oi.status <> 'CANCELLED'), 0),
       o.payment_method,
       o.paid_by,
       COALESCE(o.paid_at, o.created_at)
FROM orders o
WHERE o.needs_payment = false;