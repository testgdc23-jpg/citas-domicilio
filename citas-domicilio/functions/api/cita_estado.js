// functions/api/cita_estado.js
export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body;
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 }); }

  const cita_id = Number(body.cita_id ?? 0);
  const nuevo_estado = (body.nuevo_estado ?? "").toString().trim().toLowerCase();
  const validos = ["agendada","confirmada","atendida","cancelada","reprogramada"];

  if (!(cita_id > 0) || !validos.includes(nuevo_estado)) {
    return Response.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }

  // Verificar cita
  const existe = await env.DB.prepare("SELECT 1 AS ok FROM cita WHERE id = ?").bind(cita_id).first();
  if (!existe?.ok) return Response.json({ ok: false, error: "Cita no existe" }, { status: 404 });

  await env.DB
    .prepare("UPDATE cita SET estado = ?, movimiento = COALESCE(movimiento, 0) + 1 WHERE id = ?")
    .bind(nuevo_estado, cita_id)
    .run();

  const cita = await env.DB.prepare("SELECT id, estado, movimiento FROM cita WHERE id = ?").bind(cita_id).first();
  return Response.json({ ok: true, data: cita });
}
