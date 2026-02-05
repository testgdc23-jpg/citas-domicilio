// GET /api/seguro -> [{ id, Nombre }]
export const onRequestGet = async ({ env }) => {
  const { results } = await env.DB
    .prepare(`SELECT id, nombre AS Nombre FROM seguro ORDER BY nombre`)
    .all();

  return new Response(JSON.stringify({ ok: true, data: results || [] }), {
    headers: { "Content-Type": "application/json" }
  });
};
