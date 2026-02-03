export async function onRequest(context) {
  const { request, env } = context;

  // =========================
  // GET /api/pago
  // Filtros:
  //  - fecha=YYYY-MM-DD   (por fecha de la CITA)
  //  - cita_id=1          (un pago por cita)
  // =========================
  if (request.method === "GET") {
    const url = new URL(request.url);
    const fecha = url.searchParams.get("fecha");
    const cita_id = url.searchParams.get("cita_id");

    let sql = `
      SELECT
        p.id,
        p.cita_id,
        p.copago,
        p.medicina,
        p.total_recibido,
        p.valor_transferido,
        p.forma_pago,
        p.fecha_pago,
        p.observaciones,

        c.fecha AS cita_fecha,
        c.hora AS cita_hora,
        c.estado AS cita_estado,

        pa.ci,
        pa.nombre,
        pa.apellido
      FROM pago p
      JOIN cita c ON c.id = p.cita_id
      JOIN paciente pa ON pa.id = c.paciente_id
      WHERE 1=1
    `;

    const binds = [];

    if (cita_id) {
      const cid = Number(cita_id);
      if (!Number.isFinite(cid) || cid <= 0) return json({ error: "cita_id inválido" }, 400);
      sql += " AND p.cita_id = ? ";
      binds.push(cid);
    }

    if (fecha) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return json({ error: "fecha inválida (use YYYY-MM-DD)" }, 400);
      }
      // filtramos por fecha de la cita (reporte diario)
      sql += " AND c.fecha = ? ";
      binds.push(fecha);
    }

    sql += " ORDER BY p.id DESC ";

    const stmt = env.DB.prepare(sql);
    const { results } = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
    return json(results, 200);
  }

  // =========================
  // POST /api/pago
  // Body:
  // {
  //   "cita_id": 3,
  //   "copago": 5.00,
  //   "medicina": 2.50,
  //   "valor_transferido": 0,
  //   "forma_pago": "efectivo" | "transferencia",
  //   "fecha_pago": "2026-02-03",
  //   "observaciones": "..."
  // }
  // =========================
  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "JSON inválido" }, 400);
    }

    const cita_id = Number(body.cita_id);
    const copago = toMoney(body.copago);
    const medicina = toMoney(body.medicina);
    const valor_transferido = toMoney(body.valor_transferido);
    const forma_pago = String(body.forma_pago ?? "").trim().toLowerCase();
    const fecha_pago = String(body.fecha_pago ?? "").trim();
    const observaciones = String(body.observaciones ?? "").trim();

    if (!Number.isFinite(cita_id) || cita_id <= 0) return json({ error: "cita_id inválido" }, 400);
    if (copago === null || copago < 0) return json({ error: "copago inválido" }, 400);
    if (medicina === null || medicina < 0) return json({ error: "medicina inválida" }, 400);
    if (valor_transferido === null || valor_transferido < 0) return json({ error: "valor_transferido inválido" }, 400);

    if (!["efectivo", "transferencia"].includes(forma_pago)) {
      return json({ error: "forma_pago inválida (efectivo|transferencia)" }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_pago)) {
      return json({ error: "fecha_pago inválida (use YYYY-MM-DD)" }, 400);
    }

    // regla de negocio: total = copago + medicina
    const total_recibido = round2(copago + medicina);

    // si es transferencia, normalmente valor_transferido debería ser == total (puede ser parcial? aquí NO)
    if (forma_pago === "transferencia" && round2(valor_transferido) !== total_recibido) {
      return json({ error: "En transferencia, valor_transferido debe ser igual a total_recibido." }, 409);
    }
    if (forma_pago === "efectivo" && valor_transferido !== 0) {
      return json({ error: "En efectivo, valor_transferido debe ser 0." }, 409);
    }

    // 1) validar que exista la cita
    {
      const { results } = await env.DB
        .prepare("SELECT id FROM cita WHERE id = ? LIMIT 1")
        .bind(cita_id)
        .all();
      if (!results.length) return json({ error: "No existe la cita." }, 404);
    }

    // 2) insertar pago (1:1 con cita enforced por índice UNIQUE)
    try {
      const result = await env.DB
        .prepare(`
          INSERT INTO pago (
            cita_id, copago, medicina, total_recibido,
            valor_transferido, forma_pago, fecha_pago, observaciones
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          cita_id,
          copago,
          medicina,
          total_recibido,
          valor_transferido,
          forma_pago,
          fecha_pago,
          observaciones || null
        )
        .run();

      return json({ ok: true, id: result.meta.last_row_id }, 200);
    } catch (e) {
      const msg = String(e && (e.message || e));
      if (msg.includes("UNIQUE constraint failed") || msg.includes("SQLITE_CONSTRAINT")) {
        return json({ error: "Ya existe un pago registrado para esta cita." }, 409);
      }
      return json({ error: "Error al guardar pago." }, 500);
    }
  }

  return new Response("Method Not Allowed", { status: 405 });

  // helpers
  function json(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function toMoney(v) {
    if (v === null || v === undefined || v === "") return 0;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return round2(n);
  }
}
