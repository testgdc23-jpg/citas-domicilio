// functions/api/cita.js
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname; // /api/cita o /api/cita/:id
  const idMatch = path.match(/\/api\/cita\/(\d+)$/);
  const id = idMatch ? Number(idMatch[1]) : null;

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

  const norm = (v) => (v ?? "").toString().trim().toLowerCase();

  async function exists(table, id) {
    const row = await env.DB.prepare(`SELECT 1 AS ok FROM ${table} WHERE id = ?`).bind(id).first();
    return !!row?.ok;
  }

  // ---------- GET ----------
  if (request.method === "GET") {
    // detalle
    if (id) {
      const row = await env.DB.prepare(
        `SELECT c.id, c.paciente_id, c.direccion_id, c.seguro_id, c.fecha, c.hora,
                c.sintomas, c.asistencia, c.movimiento, c.estado
         FROM cita c
         WHERE c.id = ?`
      ).bind(id).first();

      if (!row) return json({ ok: false, error: "Cita no encontrada" }, 404);
      return json({ ok: true, data: row });
    }

    // filtros opcionales: paciente_id, fecha
    const pacienteId = Number(url.searchParams.get("paciente_id") ?? 0);
    const fecha = url.searchParams.get("fecha") ?? "";
    let sql = `SELECT id, paciente_id, direccion_id, seguro_id, fecha, hora, sintomas, asistencia, movimiento, estado
               FROM cita`;
    const params = [];
    const where = [];

    if (pacienteId > 0) { where.push("paciente_id = ?"); params.push(pacienteId); }
    if (fecha) { where.push("fecha = ?"); params.push(fecha); }

    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY fecha DESC, hora DESC, id DESC";

    const { results } = await env.DB.prepare(sql).bind(...params).all();
    return json({ ok: true, data: results ?? [] });
  }

  // ---------- POST (crear) ----------
  if (request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: "JSON inválido" }, 400); }

    const paciente_id = Number(body.paciente_id ?? 0);
    const direccion_id = Number(body.direccion_id ?? 0);
    const seguro_id = body.seguro_id ? Number(body.seguro_id) : null;
    const fecha = (body.fecha ?? "").toString().trim(); // YYYY-MM-DD
    const hora = (body.hora ?? "").toString().trim();   // HH:MM
    const sintomas = (body.sintomas ?? "").toString().trim();
    const estado = norm(body.estado || "agendada");     // default

    if (!(paciente_id > 0) || !(direccion_id > 0) || !fecha || !hora) {
      return json({ ok: false, error: "Campos requeridos: paciente_id, direccion_id, fecha, hora" }, 400);
    }
    if (!["agendada","confirmada","atendida","cancelada","reprogramada"].includes(estado)) {
      return json({ ok: false, error: "Estado inválido" }, 400);
    }

    // Verificar FKs
    const [okPac, okDir] = await Promise.all([exists("paciente", paciente_id), exists("direccion", direccion_id)]);
    if (!okPac) return json({ ok: false, error: "Paciente no existe" }, 404);
    if (!okDir) return json({ ok: false, error: "Dirección no existe" }, 404);

    try {
      const res = await env.DB
        .prepare(
          `INSERT INTO cita
           (paciente_id, direccion_id, seguro_id, fecha, hora, sintomas, asistencia, movimiento, estado)
           VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)`
        )
        .bind(paciente_id, direccion_id, seguro_id, fecha, hora, sintomas || null, estado)
        .run();

      return json({ ok: true, id: res.meta?.last_row_id ?? null }, 201);
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (msg.includes("UNIQUE") || msg.includes("idx_cita_unq")) {
        return json({ ok: false, error: "Ya existe una cita para ese paciente, dirección, fecha y hora" }, 409);
      }
      return json({ ok: false, error: "Error al crear cita" }, 500);
    }
  }

  // ---------- PUT /api/cita/:id (editar campos no-estado) ----------
  if (request.method === "PUT") {
    if (!id) return json({ ok: false, error: "Falta /:id en la ruta" }, 400);

    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: "JSON inválido" }, 400); }

    // Cargar actual
    const current = await env.DB.prepare(
      `SELECT id, paciente_id, direccion_id, seguro_id, fecha, hora, sintomas, asistencia, movimiento, estado
       FROM cita WHERE id = ?`
    ).bind(id).first();
    if (!current) return json({ ok: false, error: "Cita no encontrada" }, 404);

    // Merge
    const paciente_id = body.paciente_id ? Number(body.paciente_id) : current.paciente_id;
    const direccion_id = body.direccion_id ? Number(body.direccion_id) : current.direccion_id;
    const seguro_id = body.seguro_id !== undefined ? Number(body.seguro_id) : current.seguro_id;
    const fecha = body.fecha !== undefined ? (body.fecha ?? "").toString().trim() : current.fecha;
    const hora = body.hora !== undefined ? (body.hora ?? "").toString().trim() : current.hora;
    const sintomas = body.sintomas !== undefined ? (body.sintomas ?? "").toString().trim() : current.sintomas;
    const asistencia = body.asistencia !== undefined ? Number(body.asistencia) : current.asistencia;

    // Validaciones básicas
    if (!(paciente_id > 0) || !(direccion_id > 0) || !fecha || !hora) {
      return json({ ok: false, error: "paciente_id, direccion_id, fecha, hora no pueden quedar vacíos" }, 400);
    }

    // Verificar FKs si cambian
    if (paciente_id !== current.paciente_id && !(await exists("paciente", paciente_id))) {
      return json({ ok: false, error: "Paciente no existe" }, 404);
    }
    if (direccion_id !== current.direccion_id && !(await exists("direccion", direccion_id))) {
      return json({ ok: false, error: "Dirección no existe" }, 404);
    }

    try {
      const res = await env.DB
        .prepare(
          `UPDATE cita
           SET paciente_id=?, direccion_id=?, seguro_id=?, fecha=?, hora=?, sintomas=?, asistencia=?
           WHERE id = ?`
        )
        .bind(paciente_id, direccion_id, seguro_id, fecha, hora, sintomas || null, asistencia ?? 0, id)
        .run();

      if ((res.meta?.changes ?? 0) === 0) return json({ ok: false, error: "Sin cambios" }, 200);
      return json({ ok: true });
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (msg.includes("UNIQUE") || msg.includes("idx_cita_unq")) {
        return json({ ok: false, error: "Conflicto: combinación paciente/dirección/fecha/hora ya existe" }, 409);
      }
      return json({ ok: false, error: "Error al actualizar cita" }, 500);
    }
  }

  // ---------- DELETE /api/cita/:id ----------
  if (request.method === "DELETE") {
    if (!id) return json({ ok: false, error: "Falta /:id en la ruta" }, 400);

    const res = await env.DB.prepare("DELETE FROM cita WHERE id = ?").bind(id).run();
    if ((res.meta?.changes ?? 0) === 0) return json({ ok: false, error: "Cita no encontrada" }, 404);
    return json({ ok: true });
  }

  return new Response("Method Not Allowed", { status: 405 });
}
