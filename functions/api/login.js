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
  // Force re-deploy
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return jsonResponse({ error: 'Username and password are required.' }, 400);
    }

    if (!env.DB) {
      return jsonResponse({ error: 'Database binding not configured.' }, 500);
    }

    const email = String(username).trim().toLowerCase();

    // Fetch user from database
    const row = await env.DB
      .prepare('SELECT email, password_hash, active FROM members WHERE email = ? LIMIT 1')
      .bind(email)
      .first();

    if (!row || Number(row.active) !== 1) {
      return jsonResponse({ error: 'Invalid username or password.' }, 401);
    }

    // Hash the incoming password and compare
    const passwordHash = await sha256Hex(String(password));
    
    if (row.password_hash !== passwordHash) {
      return jsonResponse({ error: 'Invalid username or password.' }, 401);
    }

    return jsonResponse({ ok: true, email: row.email });
  } catch (error) {
    console.error('Login error:', error);
    return jsonResponse({ error: 'Login error: ' + error.message }, 400);
  }
}
