-- Tip amount carried on the fiscal receipt so it prints as a "Tips" line
-- (VAT 0%) and is preserved on retry. NULL/0 = no tip line.
ALTER TABLE fiscal_receipts ADD COLUMN tip NUMERIC(19, 2);
