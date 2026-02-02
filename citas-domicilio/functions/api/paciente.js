export async function onRequest(context) {
  const { request, env } = context;

  // =========================
  // GET /api/paciente  (lista)
  // GET /api/paciente?ci=... (busca por CI)
  // =========================
  if (request.method === "GET") {
    const url = new URL(request.url);
    const ci = (url.searchParams.get("ci") ?? "").trim();

    if (ci) {
      const { results } = await env.DB
        .prepare("SELECT id, ci, nombre, apellido, telefono FROM paciente WHERE ci = ? LIMIT 1")
        .bind(ci)
        .all();

      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { results } = await env.DB
      .prepare("SELECT id, ci, nombre, apellido, telefono FROM paciente ORDER BY id DESC")
      .all();

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // =========================
  // POST /api/paciente (crea)
  // =========================
  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ci = (body.ci ?? "").toString().trim();
    const nombre = (body.nombre ?? "").toString().trim();
    const apellido = (body.apellido ?? "").toString().trim();
    const telefono = (body.telefono ?? "").toString().trim();

    if (!ci || !nombre || !apellido) {
      return new Response(JSON.stringify({ error: "Campos requeridos: ci, nombre, apellido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const result = await env.DB
        .prepare("INSERT INTO paciente (ci, nombre, apellido, telefono) VALUES (?, ?, ?, ?)")
        .bind(ci, nombre, apellido, telefono)
        .run();

      return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      const msg = String(e?.message || e);

      // Cuando existe el UNIQUE INDEX idx_paciente_ci, un duplicado cae aquí
      if (msg.includes("UNIQUE") || msg.includes("constraint failed")) {
        return new Response(JSON.stringify({ error: "Ya existe un paciente con esa CI." }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Error al guardar paciente." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
}
