async function sha256Hex(value) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(data, status = 200) {
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

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const email = String(body.username || body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email) {
      return jsonResponse({ error: 'Email is required' }, 400);
    }
    if (!password || password.length < 4) {
      return jsonResponse({ error: 'Password must be at least 4 characters' }, 400);
    }

    if (!env.DB) {
      return jsonResponse({ error: 'Database not configured' }, 500);
    }

    // Hash the password
    const passwordHash = await sha256Hex(password);

    // Insert into members table
    try {
      await env.DB
        .prepare('INSERT INTO members (email, password_hash, active) VALUES (?, ?, 1)')
        .bind(email, passwordHash)
        .run();

      return jsonResponse({ 
        success: true, 
        email: email, 
        message: 'Registration successful!' 
      });
    } catch (dbError) {
      if (String(dbError.message).includes('UNIQUE')) {
        return jsonResponse({ error: 'Email already registered' }, 409);
      }
      console.error('Registration DB error:', dbError);
      return jsonResponse({ error: 'Registration failed' }, 500);
    }
  } catch (e) {
    console.error('Registration error:', e);
    return jsonResponse({ error: 'Invalid request payload.' }, 400);
  }
}
