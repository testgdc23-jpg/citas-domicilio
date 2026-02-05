// GET /api/seguro -> [{ id, Nombre }]
export const onRequestGet = async ({ env }) => {
  const { results } = await env.DB
    .prepare(`SELECT id, Nombre FROM SEGURO ORDER BY Nombre`)
    .all();

  return new Response(JSON.stringify({ ok: true, data: results || [] }), {
    headers: { "Content-Type": "application/json" }
  });
};
