#!/usr/bin/env python3
"""Message database for full memory persistence"""

import sqlite3
import sys
import os
import json
from datetime import datetime

DB_PATH = "/root/clawd/data/messages.db"

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id TEXT,
            timestamp TEXT,
            timestamp_unix INTEGER,
            sender TEXT,
            sender_id TEXT,
            channel TEXT,
            content TEXT,
            media_path TEXT,
            raw_json TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp_unix)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_sender ON messages(sender_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_content ON messages(content)')
    conn.commit()
    conn.close()
    print(f"Database initialized: {DB_PATH}")

def log_message(message_id, timestamp, sender, sender_id, channel, content, media_path=None, raw_json=None):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Parse timestamp
    try:
        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        ts_unix = int(dt.timestamp())
    except:
        ts_unix = int(datetime.now().timestamp())
    
    c.execute('''
        INSERT INTO messages (message_id, timestamp, timestamp_unix, sender, sender_id, channel, content, media_path, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (message_id, timestamp, ts_unix, sender, sender_id, channel, content, media_path, raw_json))
    
    conn.commit()
    conn.close()
    print(f"Logged message {message_id}")

def query(q, limit=20):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    c.execute('''
        SELECT * FROM messages 
        WHERE content LIKE ? 
        ORDER BY timestamp_unix DESC 
        LIMIT ?
    ''', (f'%{q}%', limit))
    
    rows = c.fetchall()
    conn.close()
    
    for row in rows:
        print(f"[{row['timestamp']}] {row['sender']}: {row['content'][:100]}")
    
    return rows

def get_by_time(date_str, time_str=None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    if time_str:
        # Specific time lookup
        c.execute('''
            SELECT * FROM messages 
            WHERE timestamp LIKE ?
            ORDER BY timestamp_unix
        ''', (f'{date_str}%{time_str}%',))
    else:
        # Whole day
        c.execute('''
            SELECT * FROM messages 
            WHERE timestamp LIKE ?
            ORDER BY timestamp_unix
        ''', (f'{date_str}%',))
    
    rows = c.fetchall()
    conn.close()
    
    for row in rows:
        print(f"[{row['timestamp']}] {row['sender']}: {row['content'][:100]}")
    
    return rows

def stats():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT COUNT(*) FROM messages')
    count = c.fetchone()[0]
    c.execute('SELECT MIN(timestamp), MAX(timestamp) FROM messages')
    range_row = c.fetchone()
    conn.close()
    print(f"Total messages: {count}")
    print(f"Date range: {range_row[0]} to {range_row[1]}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  message-db.py init              - Initialize database")
        print("  message-db.py log <json>        - Log a message (JSON)")
        print("  message-db.py query <text>      - Search messages")
        print("  message-db.py date <YYYY-MM-DD> [HH:MM] - Get by date/time")
        print("  message-db.py stats             - Show statistics")
        sys.exit(1)
    
    cmd = sys.argv[1]
    
    if cmd == "init":
        init_db()
    elif cmd == "log":
        data = json.loads(sys.argv[2])
        log_message(
            data.get('message_id'),
            data.get('timestamp'),
            data.get('sender'),
            data.get('sender_id'),
            data.get('channel'),
            data.get('content'),
            data.get('media_path'),
            json.dumps(data)
        )
    elif cmd == "query":
        query(sys.argv[2])
    elif cmd == "date":
        date = sys.argv[2]
        time = sys.argv[3] if len(sys.argv) > 3 else None
        get_by_time(date, time)
    elif cmd == "stats":
        stats()
