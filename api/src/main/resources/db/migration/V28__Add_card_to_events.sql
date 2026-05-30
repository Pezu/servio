-- "Card" flag on events (toggled in Backoffice → Clients → Events table),
-- alongside require_validation and paused.
ALTER TABLE events ADD COLUMN card BOOLEAN NOT NULL DEFAULT false;
