export async function onRequestPost({ request, env }) {
  try {
    const { userId, token, state } = await request.json();
    if (!userId || !token || !state) return new Response('Bad request', { status: 400 });

    const auth = await env.PROGRESS.get(`auth:${userId}`);
    if (!auth || auth !== token) return new Response('Unauthorized', { status: 401 });

    await env.PROGRESS.put(`state:${userId}`, JSON.stringify(state));
    return new Response('OK');
  } catch (e) {
    return new Response('Invalid JSON', { status: 400 });
  }
}