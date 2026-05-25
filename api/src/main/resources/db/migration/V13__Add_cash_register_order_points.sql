-- After the bridge auth refactor (single X-Bridge-Key matched against bridge.api-key,
-- commit 5b6f00f), per-register shared tokens are dead state — the agent no longer
-- presents them. Drop the column.
ALTER TABLE cash_registers DROP COLUMN IF EXISTS shared_token;

-- Per-event mapping from cash register to order point. An order point may be
-- assigned to at most one cash register within a given event; the unique
-- constraint on (event_id, order_point_id) enforces that.
CREATE TABLE cash_register_order_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    order_point_id UUID NOT NULL REFERENCES order_points(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_crop_event_order_point UNIQUE (event_id, order_point_id)
);

CREATE INDEX idx_crop_cash_register_id ON cash_register_order_points(cash_register_id);
CREATE INDEX idx_crop_event_id ON cash_register_order_points(event_id);
CREATE INDEX idx_crop_order_point_id ON cash_register_order_points(order_point_id);
