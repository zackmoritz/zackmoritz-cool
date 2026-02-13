-- Add a simple test table for D1 verification
CREATE TABLE IF NOT EXISTS test_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
