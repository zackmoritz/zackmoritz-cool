-- Optional starter data
INSERT OR IGNORE INTO categories (name) VALUES
  ('Workshop'),
  ('Garage'),
  ('Storage');

INSERT INTO inventory_items (category_id, item_name, quantity, location)
SELECT c.id, 'Example Hammer', 1, 'Shelf A'
FROM categories c
WHERE c.name = 'Garage'
  AND NOT EXISTS (
    SELECT 1 FROM inventory_items WHERE item_name = 'Example Hammer'
  );
