# D1 database setup and table creation using `.sql` files

## 1) Create the D1 database

```bash
npx wrangler d1 create zackmoritz-cool-db
```

Copy the returned `database_id` into `wrangler.toml`.

## 2) Apply migrations locally

```bash
npx wrangler d1 migrations apply zackmoritz-cool-db --local
```

## 3) Apply migrations remotely

```bash
npx wrangler d1 migrations apply zackmoritz-cool-db --remote
```

## 4) Validate SQL files without Cloudflare access

```bash
python3 scripts/test-d1-sql.py
```

This executes all files in `d1/migrations/*.sql` against an in-memory SQLite database and verifies table creation + seed inserts.
