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

        cur.execute("SELECT COUNT(*) FROM members")
        members_count = cur.fetchone()[0]

        cur.execute("SELECT email FROM members WHERE email = 'zackmoritz94@gmail.com' LIMIT 1")
        seeded_user = cur.fetchone()

        print(f"members rows: {members_count}")
        print(f"seeded login user present: {bool(seeded_user)}")
        return 0
    except sqlite3.DatabaseError as exc:
        print(f"SQL validation failed: {exc}")
        return 2
    finally:
        con.close()


if __name__ == "__main__":
    sys.exit(run())
