// /api/diagnostico  (POST/PUT)  Body: { cita_id, diagnostico, medicacion_administrada?, receta?, tratamiento?, observaciones? }
export const onRequest = async (ctx) => {
  const { request, env } = ctx;
  const json = (d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json'}});

  // --- Autenticación opcional ---
  const AUTH_DISABLED = String(env.DISABLE_AUTH || '').trim() === '1' || !env.AUTH_SECRET;
  if (!AUTH_DISABLED) {
    // Intenta leer cookie 'auth'; si no hay, bloquea.
    const cookie = request.headers.get('Cookie') || '';
    if (!/auth=/.test(cookie)) return json({ ok:false, error:'No autenticado' }, 401);
  }

  if (request.method !== 'POST' && request.method !== 'PUT')
    return new Response('Method Not Allowed', { status:405 });

  let body; try { body = await request.json(); } catch { return json({ ok:false, error:'JSON inválido' },400); }

  const cita_id = Number(body.cita_id ?? 0);
  if (!cita_id) return json({ ok:false, error:'cita_id requerido' },400);

  const diagnostico = (body.diagnostico ?? '').toString().trim();
  const medicacion_administrada = (body.medicacion_administrada ?? '').toString().trim() || null;
  const receta = (body.receta ?? '').toString().trim() || null;
  const tratamiento = (body.tratamiento ?? '').toString().trim() || null;
  const observaciones = (body.observaciones ?? '').toString().trim() || null;

  const sql = `
    INSERT INTO diagnostico (Cita_id, Diagnostico, Medicacion_Administrada, Receta, Tratamiento, Observaciones)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(Cita_id) DO UPDATE SET
      Diagnostico=excluded.Diagnostico,
      Medicacion_Administrada=excluded.Medicacion_Administrada,
      Receta=excluded.Receta,
      Tratamiento=excluded.Tratamiento,
      Observaciones=excluded.Observaciones
  `;
  await env.DB.prepare(sql).bind(
    cita_id, diagnostico, medicacion_administrada, receta, tratamiento, observaciones
  ).run();

  // marcar cita atendida si quieres
  await env.DB.prepare(`UPDATE cita SET Estado='atendida' WHERE id=?`).bind(cita_id).run();

  return json({ ok:true });
};
