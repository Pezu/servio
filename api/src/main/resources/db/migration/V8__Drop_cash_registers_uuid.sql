-- The cash_registers row id is now used directly as the agent's deviceId, so
-- the separate uuid column is redundant. Drop it (and the index added in V7).
DROP INDEX IF EXISTS idx_cash_registers_uuid;
ALTER TABLE cash_registers DROP COLUMN IF EXISTS uuid;
