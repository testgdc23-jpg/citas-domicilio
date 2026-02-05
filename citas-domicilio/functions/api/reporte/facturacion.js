// GET /api/reporte/facturacion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&seguro_id=#
export const onRequestGet = async ({ env, request }) => {
  const url = new URL(request.url);
  const desde = (url.searchParams.get('desde') || '').trim();
  const hasta = (url.searchParams.get('hasta') || '').trim();
  const seguro_id = Number(url.searchParams.get('seguro_id') || 0);

  let sql = `
    SELECT
      p.id as pago_id,
      c.id as cita_id,
      c.Fecha as fecha,
      c.Hora as hora,
      s.Nombre as seguro,
      pa.CI as paciente_ci,
      TRIM(pa.Nombre || ' ' || pa.Apellido) as paciente_nombre,
      p.Copago as copago,
      p.Medicina as medicina,
      p.TotalRecibido as total,
      p.ValorTransferido as transferido,
      p.FormaPago as forma_pago,
      p.FechaPago as fecha_pago
    FROM PAGO p
    JOIN CITA c ON c.id = p.Cita_id
    LEFT JOIN SEGURO s ON s.id = c.Seguro_id
    JOIN PACIENTE pa ON pa.id = c.Paciente_id
    WHERE 1=1
  `;
  const params = [];
  if (desde) { sql += ` AND date(c.Fecha) >= date(?)`; params.push(desde); }
  if (hasta) { sql += ` AND date(c.Fecha) <= date(?)`; params.push(hasta); }
  if (seguro_id) { sql += ` AND c.Seguro_id = ?`; params.push(seguro_id); }
  sql += ` ORDER BY c.Fecha DESC, c.Hora DESC`;

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  const rows = results || [];

  const header = [
    'pago_id','cita_id','fecha','hora','seguro','paciente_ci','paciente_nombre',
    'copago','medicina','total','transferido','forma_pago','fecha_pago'
  ];
  const csv = [
    header.join(','),
    ...rows.map(r => header.map(h => {
      const v = r[h] ?? '';
      return /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g,'""')}"` : v;
    }).join(','))
  ].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="facturacion_${desde||'inicio'}_${hasta||'fin'}.csv"`
    }
  });
};
