-- Change event start_date and end_date from TIMESTAMP to DATE
ALTER TABLE events ALTER COLUMN start_date TYPE DATE USING start_date::DATE;
ALTER TABLE events ALTER COLUMN end_date TYPE DATE USING end_date::DATE;