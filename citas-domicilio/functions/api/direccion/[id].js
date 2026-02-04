// functions/api/direccion/[id].js
export async function onRequest(context) {
  const { request, env, params } = context;
  const { id } = params; // <- "2" si llamas /api/direccion/2

  const dirId = Number(String(id).trim());
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

  if (!Number.isFinite(dirId) || dirId <= 0) {
    return json({ ok: false, error: "ID inválido" }, 400);
  }

  // Helpers
  const norm = (v) => (v ?? "").toString().trim();
  const isEmpty = (v) => !v || v.length === 0;

  // ---------- GET /api/direccion/:id ----------
  if (request.method === "GET") {
    const row = await env.DB
      .prepare(
        `SELECT id, paciente_id, direccion, ciudad, zona, referencia, sector
         FROM direccion WHERE id = ?`
      )
      .bind(dirId)
      .first();

    if (!row) return json({ ok: false, error: "Dirección no encontrada" }, 404);
    return json({ ok: true, data: row });
  }

  // ---------- PUT /api/direccion/:id ----------
  if (request.method === "PUT") {
    let body;
    try { body = await request.json(); } catch { return json({ ok:false, error:"JSON inválido" }, 400); }

    // Cargar existente
    const current = await env.DB
      .prepare(
        `SELECT id, paciente_id, direccion, ciudad, zona, referencia, sector
         FROM direccion WHERE id = ?`
      )
      .bind(dirId)
      .first();

    if (!current) return json({ ok:false, error:"Dirección no encontrada" }, 404);

    // Merge de campos
    const paciente_id = body.paciente_id ? Number(body.paciente_id) : current.paciente_id;
    const direccion = body.direccion !== undefined ? norm(body.direccion) : current.direccion;
    const ciudad = body.ciudad !== undefined ? norm(body.ciudad) : current.ciudad;
    const referencia = body.referencia !== undefined ? norm(body.referencia) : current.referencia;
    const sector = body.sector !== undefined ? norm(body.sector) : current.sector;
    let zona = body.zona !== undefined ? norm(body.zona).toLowerCase() : current.zona;

    if (!(paciente_id > 0) || isEmpty(direccion)) {
      return json({ ok:false, error:"paciente_id y direccion no pueden quedar vacíos" }, 400);
    }
    if (zona && !["urbano","extraurbano"].includes(zona)) zona = "urbano";

    const res = await env.DB
      .prepare(
        `UPDATE direccion
         SET paciente_id = ?, direccion = ?, ciudad = ?, zona = ?, referencia = ?, sector = ?
         WHERE id = ?`
      )
      .bind(paciente_id, direccion, ciudad, zona || null, referencia, sector, dirId)
      .run();

    if ((res.meta?.changes ?? 0) === 0) return json({ ok:false, error:"Sin cambios" }, 200);
    return json({ ok:true });
  }

  // ---------- DELETE /api/direccion/:id ----------
  if (request.method === "DELETE") {
    const res = await env.DB.prepare("DELETE FROM direccion WHERE id = ?").bind(dirId).run();
    if ((res.meta?.changes ?? 0) === 0) return json({ ok:false, error:"Dirección no encontrada" }, 404);
    return json({ ok:true });
  }

  return new Response("Method Not Allowed", { status: 405 });
}
