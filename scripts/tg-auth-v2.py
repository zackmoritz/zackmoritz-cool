#!/usr/bin/env python3
"""Telegram User API authentication v2 - proper hash handling"""

import asyncio
import sys
import os
import json
from telethon import TelegramClient
from telethon.sessions import StringSession

API_ID = 36914514
API_HASH = "f3ffd24ee5b82710854d188f44473ad7"
PHONE = "+18153157696"
SESSION_FILE = "/root/clawd/secrets/telegram-session.txt"
STATE_FILE = "/tmp/tg_auth_state.json"

async def send_code():
    client = TelegramClient(StringSession(), API_ID, API_HASH)
    await client.connect()
    
    result = await client.send_code_request(PHONE)
    
    state = {
        "session": client.session.save(),
        "phone_code_hash": result.phone_code_hash
    }
    with open(STATE_FILE, "w") as f:
        json.dump(state, f)
    
    print("CODE_SENT")
    await client.disconnect()

async def verify(code, password=None):
    if not os.path.exists(STATE_FILE):
        print("ERROR: No pending auth. Run without args first.")
        return
    
    with open(STATE_FILE, "r") as f:
        state = json.load(f)
    
    client = TelegramClient(StringSession(state["session"]), API_ID, API_HASH)
    await client.connect()
    
    try:
        await client.sign_in(PHONE, code, phone_code_hash=state["phone_code_hash"])
    except Exception as e:
        err_type = type(e).__name__
        if "SessionPasswordNeeded" in err_type or "password" in str(e).lower():
            if password:
                await client.sign_in(password=password)
            else:
                # Save session for 2FA
                state["session"] = client.session.save()
                with open(STATE_FILE, "w") as f:
                    json.dump(state, f)
                print("2FA_REQUIRED")
                await client.disconnect()
                return
        else:
            print(f"ERROR: {e}")
            await client.disconnect()
            return
    
    # Success
    os.makedirs(os.path.dirname(SESSION_FILE), exist_ok=True)
    with open(SESSION_FILE, "w") as f:
        f.write(client.session.save())
    
    os.remove(STATE_FILE)
    
    me = await client.get_me()
    print(f"SUCCESS: {me.first_name} (@{me.username})")
    await client.disconnect()

async def verify_2fa(password):
    if not os.path.exists(STATE_FILE):
        print("ERROR: No pending auth.")
        return
    
    with open(STATE_FILE, "r") as f:
        state = json.load(f)
    
    client = TelegramClient(StringSession(state["session"]), API_ID, API_HASH)
    await client.connect()
    
    try:
        await client.sign_in(password=password)
    except Exception as e:
        print(f"ERROR: {e}")
        await client.disconnect()
        return
    
    os.makedirs(os.path.dirname(SESSION_FILE), exist_ok=True)
    with open(SESSION_FILE, "w") as f:
        f.write(client.session.save())
    
    os.remove(STATE_FILE)
    
    me = await client.get_me()
    print(f"SUCCESS: {me.first_name} (@{me.username})")
    await client.disconnect()

if __name__ == "__main__":
    if len(sys.argv) == 1:
        asyncio.run(send_code())
    elif sys.argv[1] == "2fa":
        asyncio.run(verify_2fa(sys.argv[2]))
    else:
        code = sys.argv[1]
        password = sys.argv[2] if len(sys.argv) > 2 else None
        asyncio.run(verify(code, password))
