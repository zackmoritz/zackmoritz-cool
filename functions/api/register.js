export async function onRequestPost({ request, env }) {
  try {
    const { userId, token } = await request.json();
    if (!userId || !token) return new Response('Bad request', { status: 400 });
    const key = `auth:${userId}`;
    const exists = await env.PROGRESS.get(key);
    if (!exists) {
      await env.PROGRESS.put(key, token, { expirationTtl: 60 * 60 * 24 * 365 * 5 });
    }
    return new Response('OK');
  } catch (e) {
    return new Response('Invalid JSON', { status: 400 });
  }
}