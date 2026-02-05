// functions/api/paciente.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname; // /api/paciente
  const idMatch = path.match(/\/api\/paciente\/(\d+)$/);
  const id = idMatch ? Number(idMatch[1]) : null;

  const json = (data, status = 200, headers = {}) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    });

  const norm = (v) => (v ?? "").toString().trim();
  const empty = (v) => !v || (typeof v === "string" && v.trim().length === 0);

  // -------- GET --------
  if (request.method === "GET") {
    // GET /api/paciente/:id   (nota: para Pages Functions, lo ideal sería [id].js; aquí mantenemos soporte por compatibilidad)
    if (id) {
      const row = await env.DB
        .prepare("SELECT id, ci, nombre, apellido, telefono, escuela_id FROM paciente WHERE id = ?")
        .bind(id)
        .first();
      if (!row) return json({ ok: false, error: "Paciente no encontrado" }, 404);
      return json({ ok: true, data: row });
    }

    // GET /api/paciente?ci=...
    const qci = norm(url.searchParams.get("ci"));
    if (!empty(qci)) {
      const row = await env.DB
        .prepare("SELECT id, ci, nombre, apellido, telefono, escuela_id FROM paciente WHERE ci = ? LIMIT 1")
        .bind(qci)
        .first();
      return json({ ok: true, data: row ?? null });
    }

    // GET /api/paciente (lista)
    const { results } = await env.DB
      .prepare("SELECT id, ci, nombre, apellido, telefono, escuela_id FROM paciente ORDER BY id DESC")
      .all();

    return json({ ok: true, data: results ?? [] });
  }

  // -------- POST (crear) --------
  if (request.method === "POST") {
    let body;
    try { body = await request.json(); }
    catch { return json({ ok:false, error:"JSON inválido" }, 400); }

    const ci = norm(body.ci);
    const nombre = norm(body.nombre);
    const apellido = norm(body.apellido);
    const telefono = norm(body.telefono);
    const escuela_id = body.escuela_id ? Number(body.escuela_id) : null; // opcional

    if (empty(ci) || empty(nombre) || empty(apellido)) {
      return json({ ok:false, error: "Campos requeridos: ci, nombre, apellido" }, 400);
    }

    try {
      const res = await env.DB
        .prepare("INSERT INTO paciente (ci, nombre, apellido, telefono, escuela_id) VALUES (?, ?, ?, ?, ?)")
        .bind(ci, nombre, apellido, telefono || null, escuela_id)
        .run();

      return json({ ok:true, id: res.meta?.last_row_id ?? null }, 201);
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (msg.includes("UNIQUE") || msg.includes("constraint failed")) {
        return json({ ok:false, error:"Ya existe un paciente con esa CI" }, 409);
      }
      return json({ ok:false, error:"Error al guardar paciente" }, 500);
    }
  }

  // -------- PUT /api/paciente/:id --------
  if (request.method === "PUT") {
    if (!id) return json({ ok:false, error:"Falta /:id en la ruta" }, 400);

    let body;
    try { body = await request.json(); }
    catch { return json({ ok:false, error:"JSON inválido" }, 400); }

    const ci = norm(body.ci);
    const nombre = norm(body.nombre);
    const apellido = norm(body.apellido);
    const telefono = norm(body.telefono);
    const escuela_id = body.escuela_id ? Number(body.escuela_id) : null;

    if (empty(ci) || empty(nombre) || empty(apellido)) {
      return json({ ok:false, error:"Campos requeridos: ci, nombre, apellido" }, 400);
    }

    try {
      const res = await env.DB
        .prepare(`
          UPDATE paciente
          SET ci = ?, nombre = ?, apellido = ?, telefono = ?, escuela_id = ?
          WHERE id = ?
        `)
        .bind(ci, nombre, apellido, telefono || null, escuela_id, id)
        .run();

      if ((res.meta?.changes ?? 0) === 0) {
        return json({ ok:false, error:"Paciente no encontrado" }, 404);
      }
      return json({ ok:true });
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (msg.includes("UNIQUE") || msg.includes("constraint failed")) {
        return json({ ok:false, error:"Ya existe un paciente con esa CI" }, 409);
      }
      return json({ ok:false, error:"Error al actualizar paciente" }, 500);
    }
  }

  // -------- DELETE /api/paciente/:id --------
  if (request.method === "DELETE") {
    if (!id) return json({ ok:false, error:"Falta /:id en la ruta" }, 400);

    const res = await env.DB
      .prepare("DELETE FROM paciente WHERE id = ?")
      .bind(id)
      .run();

    if ((res.meta?.changes ?? 0) === 0) {
      return json({ ok:false, error:"Paciente no encontrado" }, 404);
    }
    return json({ ok:true });
  }

  return new Response("Method Not Allowed", { status: 405 });
}
