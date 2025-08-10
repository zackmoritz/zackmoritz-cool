export async function onRequestPost({ request, env }) {
  try {
    const { userId, token } = await request.json();
    if (!userId || !token) return new Response('Bad request', { status: 400 });

    const auth = await env.PROGRESS.get(`auth:${userId}`);
    if (!auth || auth !== token) return new Response('Unauthorized', { status: 401 });

    const raw = await env.PROGRESS.get(`state:${userId}`);
    const body = raw || 'null';
    return new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch (e) {
    return new Response('Invalid JSON', { status: 400 });
  }
}