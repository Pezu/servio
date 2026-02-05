-- Create event_menu_items join table
CREATE TABLE event_menu_items (
    event_id UUID NOT NULL,
    menu_item_id UUID NOT NULL,
    PRIMARY KEY (event_id, menu_item_id),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);