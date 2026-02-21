const USER_ID = '15303afe-c09d-4c5b-9e0d-1288619186ac';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequestOptions() { return json({}); }

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: 'DB not bound' }, 500);
  const { results } = await env.DB
    .prepare('SELECT id, minutes, notes, logged_at FROM reading_logs WHERE user_id = ? ORDER BY logged_at DESC')
    .bind(USER_ID).all();
  return json({ logs: results });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'DB not bound' }, 500);
  try {
    const body = await request.json();
    const minutes = Number(body.minutes) || 0;
    if (minutes <= 0) return json({ error: 'minutes must be > 0' }, 400);
    const notes = body.notes || null;
    const logged_at = body.logged_at || new Date().toISOString();
    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO reading_logs (id, user_id, minutes, notes, logged_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, USER_ID, minutes, notes, logged_at, new Date().toISOString()).run();
    return json({ ok: true, id });
  } catch (e) {
    return json({ error: e.message }, 400);
  }
}

export async function onRequestDelete({ request, env }) {
  if (!env.DB) return json({ error: 'DB not bound' }, 500);
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id required' }, 400);
  await env.DB.prepare('DELETE FROM reading_logs WHERE id = ? AND user_id = ?').bind(id, USER_ID).run();
  return json({ ok: true });
}
