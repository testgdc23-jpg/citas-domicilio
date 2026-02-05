// POST /api/direccion
// Body: { paciente_id, ciudad?, direccion?, zona?, referencia?, sector? }
export const onRequestPost = async ({ env, request }) => {
  const json = (d,s=200)=> new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json'}});
  let body; try { body = await request.json(); } catch { return json({ ok:false, error:'JSON inválido' }, 400); }

  const paciente_id = Number(body.paciente_id ?? 0);
  const ciudad = (body.ciudad ?? '').toString().trim() || null;
  const dir = (body.direccion ?? '').toString().trim() || null;
  const zona = (body.zona ?? '').toString().trim() || null;       // 'Urbano' | 'Rural' | 'Exurbano' (o lo que uses)
  const ref  = (body.referencia ?? '').toString().trim() || null;
  const sector = (body.sector ?? '').toString().trim() || null;

  if (!paciente_id) return json({ ok:false, error:'paciente_id requerido' }, 400);

  try {
    const res = await env.DB
      .prepare(`
        INSERT INTO direccion (Paciente_id, Ciudad, Direccion, Zona, Referencia, Sector)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(paciente_id, ciudad, dir, zona, ref, sector)
      .run();

    return json({ ok:true, id: res.meta?.last_row_id ?? null }, 201);
  } catch (e) {
    return json({ ok:false, error:'Error al guardar dirección' }, 500);
  }
};
