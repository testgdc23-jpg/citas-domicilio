// functions/api/direccion.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname; // /api/direccion o /api/direccion/:id
  const idMatch = path.match(/\/api\/direccion\/(\d+)$/);
  const id = idMatch ? Number(idMatch[1]) : null;

  const json = (data, status = 200, headers = {}) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    });

  const norm = (v) => (v ?? "").toString().trim();
  const isEmpty = (v) => !v || v.length === 0;

  async function patientExists(pacienteId) {
    const row = await env.DB
      .prepare("SELECT 1 AS ok FROM paciente WHERE id = ?")
      .bind(pacienteId)
      .first();
    return !!row?.ok;
  }

// ---------- GET ----------
if (request.method === "GET") {
  // Acepta:
  //   - GET /api/direccion/:id
  //   - GET /api/direccion?id=123
  //   - GET /api/direccion?paciente_id=...
  const qsId = Number((url.searchParams.get("id") ?? "").trim());
  const targetId = id || (Number.isFinite(qsId) && qsId > 0 ? qsId : null);

  // GET por ID
  if (targetId) {
    const row = await env.DB
      .prepare(
        `SELECT id, paciente_id, direccion, ciudad, zona, referencia, sector
         FROM direccion WHERE id = ?`
      )
      .bind(targetId)
      .first();

    if (!row) return json({ ok: false, error: "Dirección no encontrada" }, 404);
    return json({ ok: true, data: row });
  }

  // GET /api/direccion?paciente_id=...
  const pacienteId = Number((url.searchParams.get("paciente_id") ?? "").trim());
  if (Number.isFinite(pacienteId) && pacienteId > 0) {
    const { results } = await env.DB
      .prepare(
        `SELECT id, paciente_id, direccion, ciudad, zona, referencia, sector
         FROM direccion
         WHERE paciente_id = ?
         ORDER BY id DESC`
      )
      .bind(pacienteId)
      .all();

    return json({ ok: true, data: results ?? [] });
  }

  // GET /api/direccion (lista completa)
  const { results } = await env.DB
    .prepare(
      `SELECT id, paciente_id, direccion, ciudad, zona, referencia, sector
       FROM direccion
       ORDER BY id DESC`
    )
    .all();

  return json({ ok: true, data: results ?? [] });
}
  // ---------- POST ----------
  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "JSON inválido" }, 400);
    }

    const paciente_id = Number(body.paciente_id ?? 0);
    const direccion = norm(body.direccion);
    const ciudad = norm(body.ciudad);
    const referencia = norm(body.referencia);
    const sector = norm(body.sector);
    let zona = norm(body.zona).toLowerCase();

    if (!(paciente_id > 0) || isEmpty(direccion)) {
      return json(
        { ok: false, error: "Campos requeridos: paciente_id, direccion" },
        400
      );
    }

    if (!["urbano", "extraurbano", ""].includes(zona)) zona = "urbano";

    if (!(await patientExists(paciente_id))) {
      return json({ ok: false, error: "Paciente no existe" }, 404);
    }

    try {
      const res = await env.DB
        .prepare(
          `INSERT INTO direccion
           (paciente_id, direccion, ciudad, zona, referencia, sector)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(paciente_id, direccion, ciudad, zona || null, referencia, sector)
        .run();

      return json({ ok: true, id: res.meta?.last_row_id ?? null }, 201);
    } catch {
      return json({ ok: false, error: "Error al guardar dirección" }, 500);
    }
  }

  // ---------- PUT /api/direccion/:id ----------
  if (request.method === "PUT") {
    if (!id) return json({ ok: false, error: "Falta /:id en la ruta" }, 400);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "JSON inválido" }, 400);
    }

    const current = await env.DB
      .prepare(
        `SELECT id, paciente_id, direccion, ciudad, zona, referencia, sector
         FROM direccion WHERE id = ?`
      )
      .bind(id)
      .first();

    if (!current) return json({ ok: false, error: "Dirección no encontrada" }, 404);

    const paciente_id = body.paciente_id ? Number(body.paciente_id) : current.paciente_id;
    const direccion = body.direccion !== undefined ? norm(body.direccion) : current.direccion;
    const ciudad = body.ciudad !== undefined ? norm(body.ciudad) : current.ciudad;
    const referencia = body.referencia !== undefined ? norm(body.referencia) : current.referencia;
    const sector = body.sector !== undefined ? norm(body.sector) : current.sector;
    let zona = body.zona !== undefined ? norm(body.zona).toLowerCase() : current.zona;

    if (!(paciente_id > 0) || isEmpty(direccion)) {
      return json({ ok: false, error: "paciente_id y direccion no pueden quedar vacíos" }, 400);
    }
    if (!["urbano", "extraurbano", ""].includes(zona)) zona = "urbano";

    if (paciente_id !== current.paciente_id && !(await patientExists(paciente_id))) {
      return json({ ok: false, error: "Paciente no existe" }, 404);
    }

    const res = await env.DB
      .prepare(
        `UPDATE direccion
         SET paciente_id = ?, direccion = ?, ciudad = ?, zona = ?, referencia = ?, sector = ?
         WHERE id = ?`
      )
      .bind(paciente_id, direccion, ciudad, zona || null, referencia, sector, id)
      .run();

    if ((res.meta?.changes ?? 0) === 0) {
      return json({ ok: false, error: "Sin cambios" }, 200);
    }
    return json({ ok: true });
  }

  // ---------- DELETE /api/direccion/:id ----------
  if (request.method === "DELETE") {
    if (!id) return json({ ok: false, error: "Falta /:id en la ruta" }, 400);

    const res = await env.DB
      .prepare("DELETE FROM direccion WHERE id = ?")
      .bind(id)
      .run();

    if ((res.meta?.changes ?? 0) === 0) {
      return json({ ok: false, error: "Dirección no encontrada" }, 404);
    }
    return json({ ok: true });
  }

  return new Response("Method Not Allowed", { status: 405 });
}

