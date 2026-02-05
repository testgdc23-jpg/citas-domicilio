// GET /api/escuela -> [{ id, Direccion, Sector }]
export const onRequestGet = async ({ env }) => {
  try {
    const { results } = await env.DB
      .prepare(`SELECT id, Direccion, Sector FROM escuela ORDER BY id`)
      .all();

    return new Response(JSON.stringify({ ok: true, data: results || [] }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
};
