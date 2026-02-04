// functions/api/cita/[id].js
export async function onRequest(context) {
  const { request, env, params } = context;
  const { id } = params;
  const citaId = Number(String(id).trim());

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

  if (!Number.isFinite(citaId) || citaId <= 0) {
    return json({ ok:false, error:"ID inválido" }, 400);
  }

  const norm = (v) => (v ?? "").toString().trim();

  async function exists(table, id) {
    const row = await env.DB.prepare(`SELECT 1 AS ok FROM ${table} WHERE id = ?`).bind(id).first();
    return !!row?.ok;
  }

  // ---------- GET /api/cita/:id ----------
  if (request.method === "GET") {
    const row = await env.DB.prepare(
      `SELECT id, paciente_id, direccion_id, seguro_id, fecha, hora, sintomas, asistencia, movimiento, estado
       FROM cita WHERE id = ?`
    ).bind(citaId).first();

    if (!row) return json({ ok:false, error:"Cita no encontrada" }, 404);
    return json({ ok:true, data: row });
  }

  // ---------- PUT /api/cita/:id ----------
  if (request.method === "PUT") {
    let body;
    try { body = await request.json(); } catch { return json({ ok:false, error:"JSON inválido" }, 400); }

    const current = await env.DB.prepare(
      `SELECT id, paciente_id, direccion_id, seguro_id, fecha, hora, sintomas, asistencia, movimiento, estado
       FROM cita WHERE id = ?`
    ).bind(citaId).first();
    if (!current) return json({ ok:false, error:"Cita no encontrada" }, 404);

    const paciente_id  = body.paciente_id  ? Number(body.paciente_id)  : current.paciente_id;
    const direccion_id = body.direccion_id ? Number(body.direccion_id) : current.direccion_id;
    const seguro_id    = body.seguro_id !== undefined ? Number(body.seguro_id) : current.seguro_id;
    const fecha        = body.fecha !== undefined ? norm(body.fecha) : current.fecha;
    const hora         = body.hora  !== undefined ? norm(body.hora)  : current.hora;
    const sintomas     = body.sintomas !== undefined ? norm(body.sintomas) : current.sintomas;
    const asistencia   = body.asistencia !== undefined ? Number(body.asistencia) : current.asistencia;

    if (!(paciente_id > 0) || !(direccion_id > 0) || !fecha || !hora) {
      return json({ ok:false, error:"paciente_id, direccion_id, fecha, hora no pueden quedar vacíos" }, 400);
    }

    // Verificar FKs si cambian
    if (paciente_id !== current.paciente_id && !(await exists("paciente", paciente_id))) {
      return json({ ok:false, error:"Paciente no existe" }, 404);
    }
    if (direccion_id !== current.direccion_id && !(await exists("direccion", direccion_id))) {
      return json({ ok:false, error:"Dirección no existe" }, 404);
    }

    try {
      const res = await env.DB.prepare(
        `UPDATE cita
         SET paciente_id=?, direccion_id=?, seguro_id=?, fecha=?, hora=?, sintomas=?, asistencia=?
         WHERE id = ?`
      ).bind(paciente_id, direccion_id, seguro_id, fecha, hora, sintomas || null, asistencia ?? 0, citaId).run();

      if ((res.meta?.changes ?? 0) === 0) return json({ ok:false, error:"Sin cambios" }, 200);
      return json({ ok:true });
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (msg.includes("UNIQUE") || msg.includes("idx_cita_unq")) {
        return json({ ok:false, error:"Conflicto: combinación paciente/dirección/fecha/hora ya existe" }, 409);
      }
      return json({ ok:false, error:"Error al actualizar cita" }, 500);
    }
  }

  // ---------- DELETE /api/cita/:id ----------
  if (request.method === "DELETE") {
    const res = await env.DB.prepare("DELETE FROM cita WHERE id = ?").bind(citaId).run();
    if ((res.meta?.changes ?? 0) === 0) return json({ ok:false, error:"Cita no encontrada" }, 404);
    return json({ ok:true });
  }

  return new Response("Method Not Allowed", { status: 405 });
}
