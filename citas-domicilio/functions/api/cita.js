export async function onRequest(context) {
  const { request, env } = context;

  // =========================
  // GET /api/cita
  // Opcional filtros:
  //  - paciente_id=1
  //  - fecha=2026-02-01
  // =========================
  if (request.method === "GET") {
    const url = new URL(request.url);

    const paciente_id = url.searchParams.get("paciente_id");
    const fecha = url.searchParams.get("fecha");

    let sql = `
      SELECT
        c.id,
        c.paciente_id,
        p.ci,
        p.nombre,
        p.apellido,

        c.direccion_id,
        d.direccion,
        d.ciudad,
        d.zona,
        d.sector,

        c.seguro_id,
        s.nombre AS seguro_nombre,

        c.fecha,
        c.hora,
        c.estado,
        c.sintomas
      FROM cita c
      JOIN paciente p ON p.id = c.paciente_id
      JOIN direccion d ON d.id = c.direccion_id
      LEFT JOIN seguro s ON s.id = c.seguro_id
      WHERE 1=1
    `;

    const binds = [];

    if (paciente_id) {
      const pid = Number(paciente_id);
      if (!Number.isFinite(pid) || pid <= 0) {
        return json({ error: "paciente_id inválido" }, 400);
      }
      sql += " AND c.paciente_id = ? ";
      binds.push(pid);
    }

    if (fecha) {
      // formato esperado YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return json({ error: "fecha inválida (use YYYY-MM-DD)" }, 400);
      }
      sql += " AND c.fecha = ? ";
      binds.push(fecha);
    }

    sql += " ORDER BY c.id DESC ";

    const stmt = env.DB.prepare(sql);
    const { results } = binds.length ? await stmt.bind(...binds).all() : await stmt.all();

    return json(results, 200);
  }

  // =========================
  // POST /api/cita
  // Body:
  // {
  //   "paciente_id": 1,
  //   "direccion_id": 2,
  //   "seguro_id": 1 (opcional),
  //   "fecha": "2026-02-01",
  //   "hora": "14:30",
  //   "sintomas": "..."
  // }
  // =========================
  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "JSON inválido" }, 400);
    }

    const paciente_id = Number(body.paciente_id);
    const direccion_id = Number(body.direccion_id);

    const seguro_id_raw = body.seguro_id;
    const seguro_id =
      seguro_id_raw === null || seguro_id_raw === undefined || seguro_id_raw === ""
        ? null
        : Number(seguro_id_raw);

    const fecha = (body.fecha ?? "").toString().trim();
    const hora = (body.hora ?? "").toString().trim();
    const sintomas = (body.sintomas ?? "").toString().trim();

    if (!Number.isFinite(paciente_id) || paciente_id <= 0) {
      return json({ error: "paciente_id inválido" }, 400);
    }
    if (!Number.isFinite(direccion_id) || direccion_id <= 0) {
      return json({ error: "direccion_id inválido" }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return json({ error: "fecha inválida (use YYYY-MM-DD)" }, 400);
    }
    // acepta HH:MM o HH:MM:SS
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(hora)) {
      return json({ error: "hora inválida (use HH:MM)" }, 400);
    }
    if (seguro_id !== null && (!Number.isFinite(seguro_id) || seguro_id <= 0)) {
      return json({ error: "seguro_id inválido" }, 400);
    }

    // 1) Validar que el paciente exista
    {
      const { results } = await env.DB
        .prepare("SELECT id FROM paciente WHERE id = ? LIMIT 1")
        .bind(paciente_id)
        .all();

      if (!results.length) {
        return json({ error: "No existe el paciente." }, 404);
      }
    }

    // 2) Validar que la dirección exista Y pertenezca al paciente
    {
      const { results } = await env.DB
        .prepare("SELECT id FROM direccion WHERE id = ? AND paciente_id = ? LIMIT 1")
        .bind(direccion_id, paciente_id)
        .all();

      if (!results.length) {
        return json({ error: "La dirección no existe o no pertenece al paciente." }, 409);
      }
    }

    // 3) (Opcional) validar seguro si viene
    if (seguro_id !== null) {
      const { results } = await env.DB
        .prepare("SELECT id FROM seguro WHERE id = ? LIMIT 1")
        .bind(seguro_id)
        .all();

      if (!results.length) {
        return json({ error: "No existe el seguro." }, 404);
      }
    }

    // 4) Insertar cita (estado por defecto)
    const estado = "agendada";

    try {
      const result = await env.DB
        .prepare(`
          INSERT INTO cita (paciente_id, direccion_id, seguro_id, fecha, hora, sintomas, estado)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(paciente_id, direccion_id, seguro_id, fecha, hora, sintomas || null, estado)
        .run();

      return json({ ok: true, id: result.meta.last_row_id }, 200);
    } catch (e) {
  // D1/SQLite devuelve errores de UNIQUE constraint cuando choca un índice unique
  const msg = String(e && (e.message || e));
  if (msg.includes("UNIQUE constraint failed") || msg.includes("constraint failed")) {
    return json({ error: "Ya existe una cita para ese paciente, dirección, fecha y hora." }, 409);
  }
  return json({ error: "Error al guardar cita." }, 500);
}

  }

  return new Response("Method Not Allowed", { status: 405 });

  // helper
  function json(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}

