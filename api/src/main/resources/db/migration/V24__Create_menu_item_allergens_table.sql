-- Create join table for menu items and allergens (many-to-many relationship)
CREATE TABLE menu_item_allergens (
    menu_item_id UUID NOT NULL,
    allergen_id UUID NOT NULL,
    PRIMARY KEY (menu_item_id, allergen_id),
    CONSTRAINT fk_menu_item_allergens_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_menu_item_allergens_allergen FOREIGN KEY (allergen_id) REFERENCES allergens(id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX idx_menu_item_allergens_menu_item ON menu_item_allergens(menu_item_id);
CREATE INDEX idx_menu_item_allergens_allergen ON menu_item_allergens(allergen_id);
