// functions/api/cita.js
export async function onRequest({ request, env }) {
  const url = new URL(request.url);

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  const norm = (v) => (v ?? "").toString().trim().toLowerCase();

  async function exists(table, id) {
    const row = await env.DB
      .prepare(`SELECT 1 AS ok FROM ${table} WHERE id = ?`)
      .bind(id)
      .first();
    return !!row?.ok;
  }

  // ---------- GET (lista/filtra) ----------
  if (request.method === "GET") {
    const pacienteId = Number(url.searchParams.get("paciente_id") ?? 0);
    const fecha = (url.searchParams.get("fecha") ?? "").toString().trim();

    let sql = `SELECT id, paciente_id, direccion_id, seguro_id, fecha, hora,
                      sintomas, asistencia, movimiento, estado
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
    try { body = await request.json(); }
    catch { return json({ ok: false, error: "JSON inválido" }, 400); }

    const paciente_id  = Number(body.paciente_id ?? 0);
    const direccion_id = Number(body.direccion_id ?? 0);
    const seguro_id    = body.seguro_id ? Number(body.seguro_id) : null;
    const fecha        = (body.fecha ?? "").toString().trim(); // YYYY-MM-DD
    const hora         = (body.hora  ?? "").toString().trim(); // HH:MM
    const sintomas     = (body.sintomas ?? "").toString().trim();
    const estado       = norm(body.estado || "agendada");

    if (!(paciente_id > 0) || !(direccion_id > 0) || !fecha || !hora) {
      return json({ ok:false, error:"Campos requeridos: paciente_id, direccion_id, fecha, hora" }, 400);
    }
    if (!["agendada","confirmada","atendida","cancelada","reprogramada"].includes(estado)) {
      return json({ ok:false, error:"Estado inválido" }, 400);
    }

    // Verificar FKs
    const [okPac, okDir] = await Promise.all([
      exists("paciente", paciente_id),
      exists("direccion", direccion_id),
    ]);
    if (!okPac) return json({ ok:false, error:"Paciente no existe" }, 404);
    if (!okDir) return json({ ok:false, error:"Dirección no existe" }, 404);

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
        return json({ ok:false, error:"Ya existe una cita para ese paciente, dirección, fecha y hora" }, 409);
      }
      return json({ ok:false, error:"Error al crear cita" }, 500);
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
}
