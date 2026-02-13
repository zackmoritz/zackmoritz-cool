-- Single-member login table for temporary membership testing
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO members (email, password, active)
SELECT 'zackmoritz94@gmail.com', '12345', 1
WHERE NOT EXISTS (
  SELECT 1 FROM members WHERE email = 'zackmoritz94@gmail.com'
);
