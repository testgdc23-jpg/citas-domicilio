export async function onRequestGet({ env }) {
  const { results } = await env.DB
    .prepare(`SELECT id, ci, nombre, apellido, telefono FROM paciente ORDER BY id DESC`)
    .all();

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" }
  });
}
