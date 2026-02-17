async function sha256Hex(value) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Not found' }, 404);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid request payload.' }, 400);
    }

    const pathname = new URL(request.url).pathname;

    if (pathname === '/login') {
      const email = String(body.username || body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (!email || !password) {
        return json({ error: 'Username and password are required.' }, 400);
      }

      const member = await env.DB
        .prepare('SELECT email, password_hash, active FROM members WHERE email = ? LIMIT 1')
        .bind(email)
        .first();

      const passwordHash = await sha256Hex(password);
      if (!member || Number(member.active) !== 1 || member.password_hash !== passwordHash) {
        return json({ error: 'Invalid username or password.' }, 401);
      }

      return json({ ok: true, email: member.email });
    }

    if (pathname === '/' || pathname === '/register') {
      const username = String(body.username || body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (!username) {
        return json({ error: 'Username is required' }, 400);
      }
      if (!password) {
        return json({ error: 'Password is required' }, 400);
      }

      const passwordHash = await sha256Hex(password);
      try {
        await env.DB
          .prepare('INSERT INTO members (email, password_hash, active) VALUES (?, ?, 1)')
          .bind(username, passwordHash)
          .run();
        return json({ success: true, email: username, message: 'Registration successful!' });
      } catch (error) {
        if (String(error.message).includes('UNIQUE')) {
          return json({ error: 'Email already registered' }, 409);
        }
        return json({ error: 'Registration failed' }, 500);
      }
    }

    return json({ error: 'Not found' }, 404);
  },
};
