import { getUserFromCookie } from './auth/_utils.js';

// POST/PUT /api/diagnostico
// Body: { cita_id, diagnostico, medicacion_administrada?, receta?, tratamiento?, observaciones? }
export const onRequest = async (ctx) => {
  const { request, env } = ctx;
  const json = (d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json'}});

  const user = await getUserFromCookie(ctx);
  if (!user) return json({ ok:false, error:'No autenticado' }, 401);
  if (user.rol !== 'medico') return json({ ok:false, error:'No autorizado' }, 403);

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
    INSERT INTO DIAGNOSTICO (Cita_id, Diagnostico, Medicacion_Administrada, Receta, Tratamiento, Observaciones, Medico_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(Cita_id) DO UPDATE SET
      Diagnostico=excluded.Diagnostico,
      Medicacion_Administrada=excluded.Medicacion_Administrada,
      Receta=excluded.Receta,
      Tratamiento=excluded.Tratamiento,
      Observaciones=excluded.Observaciones,
      Medico_id=excluded.Medico_id
  `;
  await env.DB.prepare(sql).bind(
    cita_id, diagnostico, medicacion_administrada, receta, tratamiento, observaciones, user.id
  ).run();

  // (Opcional): marcar cita atendida
  await env.DB.prepare(`UPDATE CITA SET Estado='atendida' WHERE id=?`).bind(cita_id).run();

  return json({ ok:true });
};
