#!/usr/bin/env python3
"""Import Telegram export JSON into message database"""

import sqlite3
import json
import sys
from datetime import datetime

DB_PATH = "/root/clawd/data/messages.db"

def extract_text(text_field):
    """Extract plain text from Telegram's text format"""
    if isinstance(text_field, str):
        return text_field
    elif isinstance(text_field, list):
        result = []
        for part in text_field:
            if isinstance(part, str):
                result.append(part)
            elif isinstance(part, dict):
                result.append(part.get('text', ''))
        return ''.join(result)
    return ''

def import_history(json_path):
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    messages = data.get('messages', [])
    imported = 0
    skipped = 0
    
    for msg in messages:
        if msg.get('type') != 'message':
            continue
        
        message_id = str(msg.get('id', ''))
        timestamp = msg.get('date', '')
        sender = msg.get('from', 'Unknown')
        sender_id = msg.get('from_id', '').replace('user', '')
        content = extract_text(msg.get('text', ''))
        
        # Check for media
        media_path = None
        if msg.get('photo'):
            media_path = msg.get('photo')
            if not content:
                content = '[Photo]'
        if msg.get('file'):
            media_path = msg.get('file')
            if not content:
                content = '[File]'
        
        # Skip empty messages
        if not content and not media_path:
            skipped += 1
            continue
        
        # Parse timestamp
        try:
            dt = datetime.fromisoformat(timestamp)
            ts_unix = int(dt.timestamp())
        except:
            ts_unix = int(msg.get('date_unixtime', 0))
        
        # Insert or ignore if already exists
        try:
            c.execute('''
                INSERT OR IGNORE INTO messages 
                (message_id, timestamp, timestamp_unix, sender, sender_id, channel, content, media_path, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (message_id, timestamp, ts_unix, sender, sender_id, 'telegram', content, media_path, json.dumps(msg)))
            if c.rowcount > 0:
                imported += 1
        except Exception as e:
            print(f"Error on message {message_id}: {e}")
    
    conn.commit()
    conn.close()
    
    print(f"Imported: {imported}")
    print(f"Skipped: {skipped}")
    
    # Show stats
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT COUNT(*) FROM messages')
    total = c.fetchone()[0]
    c.execute('SELECT MIN(timestamp), MAX(timestamp) FROM messages')
    range_row = c.fetchone()
    conn.close()
    
    print(f"Total in database: {total}")
    print(f"Date range: {range_row[0]} to {range_row[1]}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: import-telegram-history.py <path-to-json>")
        sys.exit(1)
    
    import_history(sys.argv[1])
