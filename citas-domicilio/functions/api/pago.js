// functions/api/pago.js
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

  // ---------- GET (lista / filtros opcionales) ----------
  if (request.method === "GET") {
    const citaId = Number(url.searchParams.get("cita_id") ?? 0);

    let sql = `SELECT id, cita_id, copago, medicina, total_recibido, valor_transferido,
                      forma_pago, fecha_pago, observaciones
               FROM pago`;
    const params = [];
    const where = [];

    if (citaId > 0) { where.push("cita_id = ?"); params.push(citaId); }

    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY id DESC";

    const { results } = await env.DB.prepare(sql).bind(...params).all();
    return json({ ok: true, data: results ?? [] });
  }

  // ---------- POST (crear) ----------
  if (request.method === "POST") {
    let body;
    try { body = await request.json(); }
    catch { return json({ ok:false, error:"JSON inválido" }, 400); }

    const cita_id          = Number(body.cita_id ?? 0);
    const copago           = Number(body.copago ?? 0);
    const medicina         = Number(body.medicina ?? 0);
    const valor_transferido= Number(body.valor_transferido ?? 0);
    const forma_pago       = norm(body.forma_pago || ""); // puede ser null
    const fecha_pago       = (body.fecha_pago ?? "").toString().trim() || null; // YYYY-MM-DD
    const observaciones    = (body.observaciones ?? "").toString().trim() || null;

    if (!(cita_id > 0)) return json({ ok:false, error:"cita_id requerido" }, 400);
    if (copago < 0 || medicina < 0 || valor_transferido < 0) {
      return json({ ok:false, error:"Montos no pueden ser negativos" }, 400);
    }
    if (forma_pago && !["efectivo","transferencia"].includes(forma_pago)) {
      return json({ ok:false, error:"forma_pago inválida" }, 400);
    }

    // FK y 1:1
    if (!(await exists("cita", cita_id))) {
      return json({ ok:false, error:"Cita no existe" }, 404);
    }

    // Cumplir CHECK: total_recibido = copago + medicina
    const total_recibido = copago + medicina;

    try {
      const res = await env.DB
        .prepare(
          `INSERT INTO pago
             (cita_id, copago, medicina, total_recibido, valor_transferido, forma_pago, fecha_pago, observaciones)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(cita_id, copago, medicina, total_recibido, valor_transferido, (forma_pago || null), fecha_pago, observaciones)
        .run();

      return json({ ok:true, id: res.meta?.last_row_id ?? null }, 201);
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (msg.includes("UNIQUE") || msg.includes("idx_pago_cita_unq")) {
        return json({ ok:false, error:"Ya existe pago para esta cita" }, 409);
      }
      // También atrapará violaciones del CHECK si algo no calza
      return json({ ok:false, error:"Error al crear pago" }, 500);
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
}
