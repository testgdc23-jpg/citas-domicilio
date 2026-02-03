export async function onRequest(context) {
  const { request, env } = context;

  // GET /api/direccion?paciente_id=1  (listar direcciones de un paciente)
  if (request.method === "GET") {
    const url = new URL(request.url);
    const paciente_id = url.searchParams.get("paciente_id");

    if (!paciente_id) {
      return new Response(JSON.stringify({ error: "Requerido: paciente_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const pid = Number(paciente_id);
    if (!Number.isFinite(pid) || pid <= 0) {
      return new Response(JSON.stringify({ error: "paciente_id inválido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { results } = await env.DB
      .prepare(
        `SELECT id, paciente_id, direccion, ciudad, zona, referencia, sector
         FROM direccion
         WHERE paciente_id = ?
         ORDER BY id DESC`
      )
      .bind(pid)
      .all();

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // POST /api/direccion  (crear dirección)
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

    const paciente_id = Number(body.paciente_id);
    const direccion = (body.direccion ?? "").toString().trim();
    const ciudad = (body.ciudad ?? "").toString().trim();
    const zona = (body.zona ?? "").toString().trim(); // "urbano" | "extraurbano" (recomendado)
    const referencia = (body.referencia ?? "").toString().trim();
    const sector = (body.sector ?? "").toString().trim();

    if (!Number.isFinite(paciente_id) || paciente_id <= 0) {
      return new Response(JSON.stringify({ error: "paciente_id inválido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!direccion) {
      return new Response(JSON.stringify({ error: "Campo requerido: direccion" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // (Opcional recomendado) validar zona
    if (zona && zona !== "urbano" && zona !== "extraurbano") {
      return new Response(JSON.stringify({ error: "zona debe ser: urbano | extraurbano" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const result = await env.DB
        .prepare(
          `INSERT INTO direccion (paciente_id, direccion, ciudad, zona, referencia, sector)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(paciente_id, direccion, ciudad || null, zona || null, referencia || null, sector || null)
        .run();

      return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Error al guardar dirección." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
}
