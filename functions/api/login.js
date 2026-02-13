export async function onRequestPost({ request, env }) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return Response.json({ error: 'Username and password are required.' }, { status: 400 });
    }

    if (!env.DB) {
      return Response.json({ error: 'Database binding not configured.' }, { status: 500 });
    }

    const email = String(username).trim().toLowerCase();

    const row = await env.DB
      .prepare('SELECT email, password, active FROM members WHERE email = ? LIMIT 1')
      .bind(email)
      .first();

    if (!row || Number(row.active) !== 1 || row.password !== String(password)) {
      return Response.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    return Response.json({ ok: true, email: row.email });
  } catch (error) {
    return Response.json({ error: 'Invalid request payload.' }, { status: 400 });
  }
}
