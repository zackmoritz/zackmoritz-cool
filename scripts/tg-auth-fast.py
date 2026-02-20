#!/usr/bin/env python3
"""Telegram User API authentication - code as argument"""

import asyncio
import sys
import os
from telethon import TelegramClient
from telethon.sessions import StringSession

API_ID = 36914514
API_HASH = "f3ffd24ee5b82710854d188f44473ad7"
PHONE = "+18153157696"
SESSION_FILE = "/root/clawd/secrets/telegram-session.txt"

async def send_code():
    client = TelegramClient(StringSession(), API_ID, API_HASH)
    await client.connect()
    sent = await client.send_code_request(PHONE)
    print(f"Code sent. Phone code hash: {sent.phone_code_hash}")
    with open("/tmp/tg_phone_hash.txt", "w") as f:
        f.write(sent.phone_code_hash)
    await client.disconnect()

async def verify_code(code, password=None):
    client = TelegramClient(StringSession(), API_ID, API_HASH)
    await client.connect()
    
    with open("/tmp/tg_phone_hash.txt", "r") as f:
        phone_hash = f.read().strip()
    
    try:
        await client.sign_in(PHONE, code, phone_code_hash=phone_hash)
    except Exception as e:
        if "password" in str(e).lower() or "2fa" in str(e).lower():
            if password:
                await client.sign_in(password=password)
            else:
                print("2FA_REQUIRED")
                await client.disconnect()
                return
        else:
            raise e
    
    # Save session
    session_str = client.session.save()
    os.makedirs(os.path.dirname(SESSION_FILE), exist_ok=True)
    with open(SESSION_FILE, "w") as f:
        f.write(session_str)
    
    me = await client.get_me()
    print(f"SUCCESS: Authenticated as {me.first_name} (@{me.username})")
    print(f"Session saved to: {SESSION_FILE}")
    
    await client.disconnect()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 tg-auth-fast.py send     - Send code")
        print("  python3 tg-auth-fast.py verify CODE [PASSWORD]")
        sys.exit(1)
    
    if sys.argv[1] == "send":
        asyncio.run(send_code())
    elif sys.argv[1] == "verify":
        code = sys.argv[2]
        password = sys.argv[3] if len(sys.argv) > 3 else None
        asyncio.run(verify_code(code, password))
