// GET /api/escuela -> [{ id, Direccion, Sector }]
export const onRequestGet = async ({ env }) => {
  const { results } = await env.DB
    .prepare(`SELECT id, Direccion, Sector FROM escuela ORDER BY id`)
    .all();

  return new
