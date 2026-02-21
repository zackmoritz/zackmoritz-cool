const USER_ID = '15303afe-c09d-4c5b-9e0d-1288619186ac';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequestOptions() {
  return jsonResponse({});
}

// GET — return all reading logs ordered by date desc
export async function onRequestGet({ env }) {
  if (!env.DB) return jsonResponse({ error: 'DB not bound' }, 500);
  const { results } = await env.DB
    .prepare('SELECT id, minutes, notes, logged_at FROM reading_logs WHERE user_id = ? ORDER BY logged_at DESC')
    .bind(USER_ID)
    .all();
  return jsonResponse({ logs: results });
}

// POST — insert a new reading session { minutes, notes, logged_at }
export async function onRequestPost({ request, env }) {
  if (!env.DB) return jsonResponse({ error: 'DB not bound' }, 500);
  try {
    const body = await request.json();
    const minutes = Math.round(Number(body.minutes) || 0);
    const notes = body.notes || null;
    const logged_at = body.logged_at || new Date().toISOString();
    const id = crypto.randomUUID();

    await env.DB
      .prepare('INSERT INTO reading_logs (id, user_id, minutes, notes, logged_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, USER_ID, minutes, notes, logged_at, new Date().toISOString())
      .run();

    return jsonResponse({ ok: true, id });
  } catch (e) {
    return jsonResponse({ error: e.message }, 400);
  }
}
