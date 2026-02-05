// POST /api/cita
// Body: { paciente_id, seguro_id, fecha, hora?, sintomas?, asistencia?, movimiento? }
export const onRequestPost = async ({ env, request }) => {
  const json = (data, status=200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type":"application/json" } });

  let body;
  try { body = await request.json(); }
  catch { return json({ ok:false, error:"JSON inválido" }, 400); }

  const paciente_id = Number(body.paciente_id ?? 0);
  const seguro_id   = Number(body.seguro_id ?? 0);
  const fecha       = (body.fecha ?? '').toString().trim();
  const hora        = (body.hora ?? '').toString().trim() || null;
  const sintomas    = (body.sintomas ?? '').toString().trim() || null;
  let   asistencia  = body.asistencia;
  let   movimiento  = body.movimiento;

  if (!paciente_id || !seguro_id || !fecha) {
    return json({ ok:false, error:"Campos requeridos: paciente_id, seguro_id, fecha" }, 400);
  }

  const seg = await env.DB
    .prepare(`SELECT id, nombre AS Nombre FROM seguro WHERE id=?`)
    .bind(seguro_id)
    .first();

  if (!seg) return json({ ok:false, error:"Seguro inválido" }, 400);

  if (seg.Nombre.toUpperCase() === 'MAWDY') {
    if (asistencia !== null && asistencia !== undefined && asistencia !== '') {
      const s = String(asistencia).trim();
      if (!/^\d{9}$/.test(s)) return json({ ok:false, error:"Asistencia debe tener 9 dígitos" }, 400);
      asistencia = Number(s);
    } else asistencia = null;

    if (movimiento !== null && movimiento !== undefined && movimiento !== '') {
      const m = String(movimiento).trim();
      if (!/^\d{6}$/.test(m)) return json({ ok:false, error:"Movimiento debe tener 6 dígitos" }, 400);
      movimiento = Number(m);
    } else movimiento = null;
  } else {
    asistencia = null;
    movimiento = null;
  }

  try {
    const res = await env.DB
      .prepare(`
        INSERT INTO cita (Paciente_id, Seguro_id, Fecha, Hora, Sintomas, Asistencia, Movimiento, Estado)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'agendada')
      `)
      .bind(paciente_id, seguro_id, fecha, hora, sintomas, asistencia, movimiento)
      .run();

    return json({ ok:true, id: res.meta?.last_row_id ?? null }, 201);
  } catch (e) {
    return json({ ok:false, error:"Error al crear cita" }, 500);
  }
};
