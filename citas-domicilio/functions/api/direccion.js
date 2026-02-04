// functions/api/direccion.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

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

  // ---------- GET (lista / por paciente_id) ----------
  if (request.method === "GET") {
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

  // ---------- POST (crear) ----------
  if (request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: "JSON inválido" }, 400); }

    const paciente_id = Number(body.paciente_id ?? 0);
    const direccion = norm(body.direccion);
    const ciudad = norm(body.ciudad);
    const referencia = norm(body.referencia);
    const sector = norm(body.sector);
    let zona = norm(body.zona).toLowerCase();

    if (!(paciente_id > 0) || isEmpty(direccion)) {
      return json({ ok: false, error: "Campos requeridos: paciente_id, direccion" }, 400);
    }
    if (zona && !["urbano","extraurbano"].includes(zona)) zona = "urbano";

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

  return new Response("Method Not Allowed", { status: 405 });
}
