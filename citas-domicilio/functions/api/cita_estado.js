export async function onRequest(context) {
  const { request, env } = context;

  function json(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    if (request.method !== "POST") {
      return json({ error: "Method Not Allowed" }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "JSON inválido" }, 400);
    }

    const cita_id = Number(body.cita_id);
    const estado = (body.estado ?? "").toString().trim();

    const ESTADOS = ["agendada", "confirmada", "atendida", "cancelada", "reprogramada"];

    if (!Number.isFinite(cita_id) || cita_id <= 0) {
      return json({ error: "cita_id inválido" }, 400);
    }
    if (!ESTADOS.includes(estado)) {
      return json({ error: "estado inválido" }, 400);
    }

    // Verifica que exista
    const { results: existe } = await env.DB
      .prepare("SELECT id, estado FROM cita WHERE id = ? LIMIT 1")
      .bind(cita_id)
      .all();

    if (!existe.length) {
      return json({ error: "No existe la cita." }, 404);
    }

    // Actualiza
    await env.DB
      .prepare("UPDATE cita SET estado = ? WHERE id = ?")
      .bind(estado, cita_id)
      .run();

    return json({ ok: true, cita_id, estado }, 200);
  } catch (e) {
    return json({ error: String(e?.message || e || "Error interno") }, 500);
  }
}
