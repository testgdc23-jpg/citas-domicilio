// functions/api/pago/[id].js
export async function onRequest(context) {
  const { request, env, params } = context;
  const { id } = params;
  const pagoId = Number(String(id).trim());

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (!Number.isFinite(pagoId) || pagoId <= 0) {
    return json({ ok:false, error:"ID inválido" }, 400);
  }

  const norm = (v) => (v ?? "").toString().trim().toLowerCase();

  // ---------- GET /api/pago/:id ----------
  if (request.method === "GET") {
    const row = await env.DB
      .prepare(
        `SELECT id, cita_id, copago, medicina, total_recibido, valor_transferido,
                forma_pago, fecha_pago, observaciones
         FROM pago WHERE id = ?`
      )
      .bind(pagoId)
      .first();

    if (!row) return json({ ok:false, error:"Pago no encontrado" }, 404);
    return json({ ok:true, data: row });
  }

  // ---------- PUT /api/pago/:id ----------
  if (request.method === "PUT") {
    let body;
    try { body = await request.json(); }
    catch { return json({ ok:false, error:"JSON inválido" }, 400); }

    const current = await env.DB
      .prepare(
        `SELECT id, cita_id, copago, medicina, total_recibido, valor_transferido,
                forma_pago, fecha_pago, observaciones
         FROM pago WHERE id = ?`
      )
      .bind(pagoId)
      .first();
    if (!current) return json({ ok:false, error:"Pago no encontrado" }, 404);

    const copago            = (body.copago !== undefined) ? Number(body.copago) : current.copago;
    const medicina          = (body.medicina !== undefined) ? Number(body.medicina) : current.medicina;
    const valor_transferido = (body.valor_transferido !== undefined) ? Number(body.valor_transferido) : current.valor_transferido;
    const forma_pago        = (body.forma_pago !== undefined) ? norm(body.forma_pago) : current.forma_pago;
    const fecha_pago        = (body.fecha_pago !== undefined) ? (body.fecha_pago ?? "").toString().trim() || null : current.fecha_pago;
    const observaciones     = (body.observaciones !== undefined) ? (body.observaciones ?? "").toString().trim() || null : current.observaciones;

    if (copago < 0 || medicina < 0 || valor_transferido < 0) {
      return json({ ok:false, error:"Montos no pueden ser negativos" }, 400);
    }
    if (forma_pago && !["efectivo","transferencia"].includes(forma_pago)) {
      return json({ ok:false, error:"forma_pago inválida" }, 400);
    }

    // Recalcular total para cumplir el CHECK
    const total_recibido = copago + medicina;

    const res = await env.DB
      .prepare(
        `UPDATE pago
           SET copago=?, medicina=?, total_recibido=?, valor_transferido=?, forma_pago=?, fecha_pago=?, observaciones=?
         WHERE id=?`
      )
      .bind(copago, medicina, total_recibido, valor_transferido, (forma_pago || null), fecha_pago, observaciones, pagoId)
      .run();

    if ((res.meta?.changes ?? 0) === 0) {
      return json({ ok:false, error:"Sin cambios" }, 200);
    }
    return json({ ok:true });
  }

  // ---------- DELETE /api/pago/:id ----------
  if (request.method === "DELETE") {
    const res = await env.DB.prepare("DELETE FROM pago WHERE id = ?").bind(pagoId).run();
    if ((res.meta?.changes ?? 0) === 0) return json({ ok:false, error:"Pago no encontrado" }, 404);
    return json({ ok:true });
  }

  return new Response("Method Not Allowed", { status: 405 });
}
