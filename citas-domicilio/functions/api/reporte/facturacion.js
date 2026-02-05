// GET /api/reporte/facturacion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&seguro_id=#
export const onRequestGet = async ({ env, request }) => {
  const jsonCSV = (text) => new Response(text, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="facturacion.csv"'
    }
  });

  try {
    const url = new URL(request.url);
    const desde = (url.searchParams.get('desde') || '').trim();
    const hasta = (url.searchParams.get('hasta') || '').trim();
    const seguro_id = Number(url.searchParams.get('seguro_id') || 0);

    let sql = `
      SELECT
        c.id              AS cita_id,
        c.Fecha           AS cita_fecha,
        c.Hora            AS cita_hora,
        c.Sintomas        AS cita_sintomas,
        c.Asistencia      AS cita_asistencia,
        c.Movimiento      AS cita_movimiento,
        c.Estado          AS cita_estado,

        s.nombre          AS seguro,

        p.CI              AS paciente_ci,
        p.Nombre          AS paciente_nombre,
        p.Apellido        AS paciente_apellido,
        p.Telefono        AS paciente_telefono,

        e.Direccion       AS escuela_direccion,
        e.Sector          AS escuela_sector,

        d.Direccion       AS direccion_calle,
        d.Zona            AS direccion_zona,
        d.Referencia      AS direccion_referencia,
        d.Sector          AS direccion_sector,

        dg.Diagnostico    AS diag_diagnostico,
        dg.Medicacion_Administrada AS diag_medicacion,
        dg.Receta         AS diag_receta,
        dg.Tratamiento    AS diag_tratamiento,
        dg.Observaciones  AS diag_observaciones,

        pg.id             AS pago_id,
        pg.Copago         AS pago_copago,
        pg.Medicina       AS pago_medicina,
        pg.TotalRecibido  AS pago_total,
        pg.ValorTransferido AS pago_transferido,
        pg.FormaPago      AS pago_forma,
        pg.FechaPago      AS pago_fecha

      FROM cita c
      JOIN paciente p        ON p.id = c.Paciente_id
      LEFT JOIN direccion d   ON d.Paciente_id = p.id
      LEFT JOIN escuela e     ON e.id = p.Escuela_id
      LEFT JOIN seguro s      ON s.id = c.Seguro_id
      LEFT JOIN diagnostico dg ON dg.Cita_id = c.id
      LEFT JOIN pago pg       ON pg.Cita_id = c.id
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
      'cita_id','cita_fecha','cita_hora','cita_sintomas','cita_asistencia','cita_movimiento','cita_estado',
      'seguro',
      'paciente_ci','paciente_nombre','paciente_apellido','paciente_telefono',
      'escuela_direccion','escuela_sector',
      'direccion_calle','direccion_zona','direccion_referencia','direccion_sector',
      'diag_diagnostico','diag_medicacion','diag_receta','diag_tratamiento','diag_observaciones',
      'pago_id','pago_copago','pago_medicina','pago_total','pago_transferido','pago_forma','pago_fecha'
    ];

    const csv = [
      header.join(','),
      ...rows.map(r => header.map(h => {
        const v = r[h] ?? '';
        return /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g,'""')}"` : v;
      }).join(','))
    ].join('\n');

    return jsonCSV(csv);
  } catch (err) {
    // Falla segura (nunca error 1101)
    const csv = 'error\n"'+ String(err).replace(/"/g,'""') + '"\n';
    return jsonCSV(csv);
  }
};
