#!/usr/bin/env python3
"""Validate D1 SQL migration files against local SQLite."""

from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "d1" / "migrations"


def run() -> int:
    migration_files = sorted(MIGRATIONS.glob("*.sql"))
    if not migration_files:
        print("No SQL files found in d1/migrations")
        return 1

    con = sqlite3.connect(":memory:")
    cur = con.cursor()

    try:
        for path in migration_files:
            sql = path.read_text(encoding="utf-8")
            cur.executescript(sql)
            print(f"Applied: {path.relative_to(ROOT)}")

        cur.execute("SELECT COUNT(*) FROM categories")
        categories_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM inventory_items")
        items_count = cur.fetchone()[0]

        print(f"categories rows: {categories_count}")
        print(f"inventory_items rows: {items_count}")
        return 0
    except sqlite3.DatabaseError as exc:
        print(f"SQL validation failed: {exc}")
        return 2
    finally:
        con.close()


if __name__ == "__main__":
    sys.exit(run())
