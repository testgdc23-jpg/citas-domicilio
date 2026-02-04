// functions/api/pago.js (borrador; te lo dejo completo cuando pasemos a Pago)
export async function onRequest({ request, env }) {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ ok:false, error:"JSON inválido" }, {status:400}); }

  const cita_id = Number(body.cita_id ?? 0);
  const copago = Number(body.copago ?? 0);
  const medicina = Number(body.medicina ?? 0);
  const valor_transferido = Number(body.valor_transferido ?? 0);
  const forma_pago = (body.forma_pago ?? "").toString().trim().toLowerCase(); // 'efectivo' | 'transferencia'
  const fecha_pago = (body.fecha_pago ?? "").toString().trim() || null;
  const observaciones = (body.observaciones ?? "").toString().trim() || null;

  if (!(cita_id > 0)) return Response.json({ ok:false, error:"cita_id requerido" }, {status:400});
  if (!["efectivo","transferencia",""].includes(forma_pago)) {
    return Response.json({ ok:false, error:"forma_pago inválida" }, {status:400});
  }

  // FK & 1:1
  const exists = await env.DB.prepare("SELECT 1 AS ok FROM cita WHERE id=?").bind(cita_id).first();
  if (!exists?.ok) return Response.json({ ok:false, error:"Cita no existe" }, {status:404});

  const total_recibido = copago + medicina; // <- necesario por CHECK

  try {
    const res = await env.DB
      .prepare(
        `INSERT INTO pago (cita_id, copago, medicina, total_recibido, valor_transferido, forma_pago, fecha_pago, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(cita_id, copago, medicina, total_recibido, valor_transferido, forma_pago || null, fecha_pago, observaciones)
      .run();

    return Response.json({ ok:true, id: res.meta?.last_row_id ?? null }, {status:201});
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (msg.includes("UNIQUE") || msg.includes("idx_pago_cita_unq")) {
      return Response.json({ ok:false, error:"Ya existe pago para esta cita" }, {status:409});
    }
    return Response.json({ ok:false, error:"Error al crear pago" }, {status:500});
  }
}
