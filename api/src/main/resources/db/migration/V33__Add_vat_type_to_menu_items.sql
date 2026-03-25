ALTER TABLE menu_items ADD COLUMN vat_type_id UUID REFERENCES vat_types(id);

CREATE INDEX idx_menu_items_vat_type_id ON menu_items(vat_type_id);