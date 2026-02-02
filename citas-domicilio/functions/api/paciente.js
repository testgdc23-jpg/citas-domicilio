export async function onRequest(context) {
  const { request, env } = context;

  // GET: listar pacientes
  if (request.method === "GET") {
    const { results } = await env.DB
      .prepare("SELECT id, ci, nombre, apellido, telefono FROM paciente ORDER BY id DESC")
      .all();

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // POST: crear paciente
  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
    }

    const ci = (body.ci ?? "").toString().trim();
    const nombre = (body.nombre ?? "").toString().trim();
    const apellido = (body.apellido ?? "").toString().trim();
    const telefono = (body.telefono ?? "").toString().trim();

    if (!ci || !nombre || !apellido) {
      return new Response(
        JSON.stringify({ error: "Campos requeridos: ci, nombre, apellido" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await env.DB
      .prepare("INSERT INTO paciente (ci, nombre, apellido, telefono) VALUES (?, ?, ?, ?)")
      .bind(ci, nombre, apellido, telefono)
      .run();

    return new Response(
      JSON.stringify({ ok: true, id: result.meta.last_row_id }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response("Method Not Allowed", { status: 405 });
}
