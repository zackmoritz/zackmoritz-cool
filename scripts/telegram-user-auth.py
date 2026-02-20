#!/usr/bin/env python3
"""Telegram User API authentication script"""

import asyncio
import sys
from telethon import TelegramClient
from telethon.sessions import StringSession

API_ID = 36914514
API_HASH = "f3ffd24ee5b82710854d188f44473ad7"
PHONE = "+18153157696"

async def main():
    if len(sys.argv) > 1 and sys.argv[1] == "auth":
        # Initial auth - will prompt for code
        client = TelegramClient(StringSession(), API_ID, API_HASH)
        await client.start(phone=PHONE)
        
        # Save session string
        session_string = client.session.save()
        print(f"\n\nSESSION_STRING={session_string}\n\n")
        
        # Save to file
        with open("/root/clawd/secrets/telegram-session.txt", "w") as f:
            f.write(session_string)
        
        print("Session saved to /root/clawd/secrets/telegram-session.txt")
        await client.disconnect()
    else:
        print("Usage: python3 telegram-user-auth.py auth")

if __name__ == "__main__":
    asyncio.run(main())
