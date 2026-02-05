// functions/api/reporte/facturacion.js
// GET /api/reporte/facturacion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&seguro_id=#
export const onRequestGet = async ({ env, request }) => {
  const send = (csv) => new Response(csv, {
    headers: {
      'Content-Type':'text/csv; charset=utf-8',
      'Content-Disposition':'attachment; filename="facturacion.csv"'
    }
  });

  try {
    const url = new URL(request.url);
    const desde = (url.searchParams.get('desde') || '').trim();
    const hasta = (url.searchParams.get('hasta') || '').trim();
    const seguro_id = Number(url.searchParams.get('seguro_id') || 0);

    // Subconsulta para "última dirección" por paciente
    const sql = `
      WITH ult_dir AS (
        SELECT d.*
        FROM direccion d
        INNER JOIN (
          SELECT Paciente_id, MAX(id) AS max_id
          FROM direccion
          GROUP BY Paciente_id
        ) x ON x.Paciente_id = d.Paciente_id AND x.max_id = d.id
      )
      SELECT
        c.id                AS cita_id,
        c.Fecha             AS cita_fecha,
        c.Hora              AS cita_hora,
        c.Sintomas          AS cita_sintomas,
        c.Asistencia        AS cita_asistencia,
        c.Movimiento        AS cita_movimiento,
        c.Estado            AS cita_estado,

        s.nombre            AS seguro,

        p.CI                AS paciente_ci,
        p.Nombre            AS paciente_nombre,
        p.Apellido          AS paciente_apellido,
        p.Telefono          AS paciente_telefono,

        e.Direccion         AS escuela_direccion,
        e.Sector            AS escuela_sector,

        ud.Ciudad           AS direccion_ciudad,
        ud.Direccion        AS direccion_calle,
        ud.Zona             AS direccion_zona,
        ud.Referencia       AS direccion_referencia,
        ud.Sector           AS direccion_sector,

        dg.Diagnostico      AS diag_diagnostico,
        dg.Medicacion_Administrada AS diag_medicacion,
        dg.Receta           AS diag_receta,
        dg.Tratamiento      AS diag_tratamiento,
        dg.Observaciones    AS diag_observaciones,

        pg.id               AS pago_id,
        pg.copago           AS pago_copago,
        pg.medicina         AS pago_medicina,
        pg.total_recibido   AS pago_total,
        pg.valor_transferido AS pago_transferido,
        pg.forma_pago       AS pago_forma,
        pg.fecha_pago       AS pago_fecha

      FROM cita c
      JOIN paciente p         ON p.id = c.Paciente_id
      LEFT JOIN ult_dir ud     ON ud.Paciente_id = p.id
      LEFT JOIN escuela e      ON e.id = p.Escuela_id
      LEFT JOIN seguro s       ON s.id = c.Seguro_id
      LEFT JOIN diagnostico dg ON dg.Cita_id = c.id
      LEFT JOIN pago pg        ON pg.Cita_id = c.id
      WHERE 1=1
      ${desde ? ` AND date(c.Fecha) >= date(?)` : ``}
      ${hasta ? ` AND date(c.Fecha) <= date(?)` : ``}
      ${seguro_id ? ` AND c.Seguro_id = ?` : ``}
      ORDER BY c.Fecha DESC, c.Hora DESC
    `;

    const params = [];
    if (desde) params.push(desde);
    if (hasta) params.push(hasta);
    if (seguro_id) params.push(seguro_id);

    const { results } = await env.DB.prepare(sql).bind(...params).all();
    const rows = results || [];

    const header = [
      'cita_id','cita_fecha','cita_hora','cita_sintomas','cita_asistencia','cita_movimiento','cita_estado',
      'seguro',
      'paciente_ci','paciente_nombre','paciente_apellido','paciente_telefono',
      'escuela_direccion','escuela_sector',
      'direccion_ciudad','direccion_calle','direccion_zona','direccion_referencia','direccion_sector',
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

    return send(csv);
  } catch (err) {
    // No explota; siempre devuelve un CSV con el error
    const csv = `error\n"${String(err).replace(/"/g,'""')}"\n`;
    return send(csv);
  }
};
