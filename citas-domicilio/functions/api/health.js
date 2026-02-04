export async function onRequest({ env }) {
  const row = await env.DB.prepare('SELECT 1 AS ok').first();
  return Response.json({ ok: row?.ok === 1 });
}
