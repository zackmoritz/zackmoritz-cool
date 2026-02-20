#!/usr/bin/env python3
"""Telegram User API authentication - single session"""

import asyncio
import sys
import os
from telethon import TelegramClient
from telethon.sessions import StringSession

API_ID = 36914514
API_HASH = "f3ffd24ee5b82710854d188f44473ad7"
PHONE = "+18153157696"
SESSION_FILE = "/root/clawd/secrets/telegram-session.txt"
TEMP_SESSION = "/tmp/tg_temp_session.txt"

async def auth_with_code(code, password=None):
    # Load temp session if exists
    session_str = ""
    if os.path.exists(TEMP_SESSION):
        with open(TEMP_SESSION, "r") as f:
            session_str = f.read().strip()
    
    client = TelegramClient(StringSession(session_str), API_ID, API_HASH)
    await client.connect()
    
    if not await client.is_user_authorized():
        if not code:
            # Send code and save session
            await client.send_code_request(PHONE)
            with open(TEMP_SESSION, "w") as f:
                f.write(client.session.save())
            print("CODE_SENT")
            await client.disconnect()
            return
        
        try:
            await client.sign_in(PHONE, code)
        except Exception as e:
            err = str(e).lower()
            if "password" in err or "2fa" in err or "SessionPasswordNeededError" in str(type(e)):
                if password:
                    await client.sign_in(password=password)
                else:
                    # Save session for password step
                    with open(TEMP_SESSION, "w") as f:
                        f.write(client.session.save())
                    print("2FA_REQUIRED")
                    await client.disconnect()
                    return
            else:
                print(f"ERROR: {e}")
                await client.disconnect()
                return
    
    # Success - save permanent session
    session_str = client.session.save()
    os.makedirs(os.path.dirname(SESSION_FILE), exist_ok=True)
    with open(SESSION_FILE, "w") as f:
        f.write(session_str)
    
    # Cleanup temp
    if os.path.exists(TEMP_SESSION):
        os.remove(TEMP_SESSION)
    
    me = await client.get_me()
    print(f"SUCCESS: {me.first_name} (@{me.username})")
    
    await client.disconnect()

if __name__ == "__main__":
    code = sys.argv[1] if len(sys.argv) > 1 else None
    password = sys.argv[2] if len(sys.argv) > 2 else None
    asyncio.run(auth_with_code(code, password))
