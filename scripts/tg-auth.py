#!/usr/bin/env python3
"""Telegram User API authentication - simpler approach"""

import asyncio
import os
from telethon import TelegramClient
from telethon.sessions import StringSession

API_ID = 36914514
API_HASH = "f3ffd24ee5b82710854d188f44473ad7"
PHONE = "+18153157696"
SESSION_FILE = "/root/clawd/secrets/telegram-session.txt"

async def main():
    client = TelegramClient(StringSession(), API_ID, API_HASH)
    
    await client.connect()
    
    if not await client.is_user_authorized():
        await client.send_code_request(PHONE)
        print("Code sent to Telegram. Enter it now:")
        code = input().strip()
        
        try:
            await client.sign_in(PHONE, code)
        except Exception as e:
            if "2FA" in str(e) or "password" in str(e).lower():
                print("2FA enabled. Enter your Telegram password:")
                password = input().strip()
                await client.sign_in(password=password)
            else:
                raise e
    
    # Save session
    session_str = client.session.save()
    os.makedirs(os.path.dirname(SESSION_FILE), exist_ok=True)
    with open(SESSION_FILE, "w") as f:
        f.write(session_str)
    
    me = await client.get_me()
    print(f"\nAuthenticated as: {me.first_name} (@{me.username})")
    print(f"Session saved to: {SESSION_FILE}")
    
    await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
