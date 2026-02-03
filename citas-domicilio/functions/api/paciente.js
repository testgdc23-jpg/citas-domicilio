// functions/api/paciente.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname; // /api/paciente o /api/paciente/:id
  const idMatch = path.match(/\/api\/paciente\/(\d+)$/);
  const id = idMatch ? Number(idMatch[1]) : null;

  const json = (data, status = 200, headers = {}) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    });

  // ---------- Helpers ----------
  const normStr = (v) => (v ?? "").toString().trim();
  const isEmpty = (v) => !v || !v.length;
  const normalizeTelefono = (t) => normStr(t).replace(/\s+/g, " ");

  // ---------- GET ----------
  if (request.method === "GET") {
    // GET /api/paciente/:id
    if (id) {
      const row = await env.DB.prepare(
        "SELECT id, ci, nombre, apellido, telefono FROM paciente WHERE id = ?"
      ).bind(id).first();

      if (!row) return json({ ok: false, error: "Paciente no encontrado" }, 404);
      return json({ ok: true, data: row });
    }

    // GET /api/paciente?ci=...
    const ci = normStr(url.searchParams.get("ci"));
    if (!isEmpty(ci)) {
      const row = await env.DB.prepare(
        "SELECT id, ci, nombre, apellido, telefono FROM paciente WHERE ci = ? LIMIT 1"
      ).bind(ci).first();

      // Devuelvo objeto o null para simplificar el frontend
      return json({ ok: true, data: row ?? null });
    }

    // GET /api/paciente (lista)
    const { results } = await env.DB
      .prepare("SELECT id, ci, nombre, apellido, telefono FROM paciente ORDER BY id DESC")
      .all();

    return json({ ok: true, data: results ?? [] });
  }

  // ---------- POST (crear) ----------
  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "JSON inválido" }, 400);
    }

    const ci = normStr(body.ci);
    const nombre = normStr(body.nombre);
    const apellido = normStr(body.apellido);
    const telefono = normalizeTelefono(body.telefono);

    if (isEmpty(ci) || isEmpty(nombre) || isEmpty(apellido)) {
      return json({ ok: false, error: "Campos requeridos: ci, nombre, apellido" }, 400);
    }

    // (Opcional) regla simple de CI — ajusta a tu caso real
    // if (ci.length !== 10) return json({ ok:false, error:"CI debe tener 10 caracteres" }, 400);

    try {
      const result = await env.DB
        .prepare("INSERT INTO paciente (ci, nombre, apellido, telefono) VALUES (?, ?, ?, ?)")
        .bind(ci, nombre, apellido, telefono)
        .run();

      return json({ ok: true, id: result.meta?.last_row_id ?? null }, 201);
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (msg.includes("UNIQUE") || msg.includes("constraint failed")) {
        return json({ ok: false, error: "Ya existe un paciente con esa CI" }, 409);
      }
      return json({ ok: false, error: "Error al guardar paciente" }, 500);
    }
  }

  // ---------- PUT /api/paciente/:id (actualizar) ----------
  if (request.method === "PUT") {
    if (!id) return json({ ok: false, error: "Falta /:id en la ruta" }, 400);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "JSON inválido" }, 400);
    }

    const ci = normStr(body.ci);
    const nombre = normStr(body.nombre);
    const apellido = normStr(body.apellido);
    const telefono = normalizeTelefono(body.telefono);

    if (isEmpty(ci) || isEmpty(nombre) || isEmpty(apellido)) {
      return json({ ok: false, error: "Campos requeridos: ci, nombre, apellido" }, 400);
    }

    try {
      const res = await env.DB
        .prepare(`
          UPDATE paciente
          SET ci = ?, nombre = ?, apellido = ?, telefono = ?
          WHERE id = ?
        `)
        .bind(ci, nombre, apellido, telefono, id)
        .run();

      if ((res.meta?.changes ?? 0) === 0) {
        return json({ ok: false, error: "Paciente no encontrado" }, 404);
      }
      return json({ ok: true });
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (msg.includes("UNIQUE") || msg.includes("constraint failed")) {
        return json({ ok: false, error: "Ya existe un paciente con esa CI" }, 409);
      }
      return json({ ok: false, error: "Error al actualizar paciente" }, 500);
    }
  }

  // ---------- DELETE /api/paciente/:id ----------
  if (request.method === "DELETE") {
    if (!id) return json({ ok: false, error: "Falta /:id en la ruta" }, 400);

    const res = await env.DB
      .prepare("DELETE FROM paciente WHERE id = ?")
      .bind(id)
      .run();

    if ((res.meta?.changes ?? 0) === 0) {
      return json({ ok: false, error: "Paciente no encontrado" }, 404);
    }
    return json({ ok: true });
  }

  return new Response("Method Not Allowed", { status: 405 });
}
