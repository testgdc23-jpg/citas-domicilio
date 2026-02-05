// functions/api/direccion/index.js
export const onRequest = async ({ request, env }) => {
  const url = new URL(request.url);
  const json = (d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json'}});

  if (request.method === 'GET') {
    const paciente_id = Number(url.searchParams.get('paciente_id') || 0);
    if (!paciente_id) return json({ ok:false, error:'paciente_id requerido' }, 400);

    const row = await env.DB
      .prepare(`SELECT id, Ciudad, Direccion, Zona, Referencia, Sector
                FROM direccion
                WHERE Paciente_id = ?
                ORDER BY id DESC
                LIMIT 1`)
      .bind(paciente_id)
      .first();

    return json({ ok:true, data: row ?? null });
  }

  if (request.method === 'POST') {
    let body; try { body = await request.json(); } catch { return json({ ok:false, error:'JSON inválido' },400); }
    const paciente_id = Number(body.paciente_id || 0);
    if (!paciente_id) return json({ ok:false, error:'paciente_id requerido' }, 400);

    const ciudad = (body.ciudad ?? '').toString().trim() || null;
    const dir    = (body.direccion ?? '').toString().trim() || null;
    const zona   = (body.zona ?? '').toString().trim() || null;
    const ref    = (body.referencia ?? '').toString().trim() || null;
    const sector = (body.sector ?? '').toString().trim() || null;

    const res = await env.DB
      .prepare(`INSERT INTO direccion (Paciente_id, Ciudad, Direccion, Zona, Referencia, Sector)
                VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(paciente_id, ciudad, dir, zona, ref, sector)
      .run();

    return json({ ok:true, id: res.meta?.last_row_id ?? null }, 201);
  }

  return new Response('Method Not Allowed', { status:405 });
};
