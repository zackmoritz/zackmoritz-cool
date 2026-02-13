-- Remove legacy/unneeded tables; keep `members` as the login source of truth.
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS test_table;
DROP TABLE IF EXISTS users;
