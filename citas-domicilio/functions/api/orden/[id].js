// GET /api/orden/:id
export const onRequestGet = async ({ env, params }) => {
  const id = Number(params?.id || 0);
  if (!id) return new Response(JSON.stringify({ ok:false, error:'id requerido' }), { status:400 });

  const sql = `
    SELECT
      c.id                 AS cita_id,
      c.Fecha              AS fecha,
      c.Hora               AS hora,
      c.Sintomas           AS sintomas,
      c.Asistencia         AS asistencia,
      c.Movimiento         AS movimiento,
      c.Estado             AS estado,

      s.nombre             AS seguro,

      p.CI                 AS paciente_ci,
      p.Nombre             AS paciente_nombre,
      p.Apellido           AS paciente_apellido,
      p.Telefono           AS paciente_telefono,

      e.Direccion          AS escuela_direccion,
      e.Sector             AS escuela_sector,

      d.Direccion          AS direccion,
      d.Zona               AS zona,
      d.Referencia         AS referencia,
      d.Sector             AS sector,

      pg.Copago            AS copago,
      pg.Medicina          AS medicina,
      pg.TotalRecibido     AS total,
      pg.ValorTransferido  AS transferido,
      pg.FormaPago         AS forma_pago,
      pg.FechaPago         AS fecha_pago

    FROM cita c
    JOIN paciente p       ON p.id = c.Paciente_id
    LEFT JOIN direccion d  ON d.Paciente_id = p.id
    LEFT JOIN escuela e    ON e.id = p.Escuela_id
    LEFT JOIN seguro s     ON s.id = c.Seguro_id
    LEFT JOIN pago pg      ON pg.Cita_id = c.id
    WHERE c.id = ?
    ORDER BY d.id DESC
    LIMIT 1
  `;
  const row = await env.DB.prepare(sql).bind(id).first();
  if (!row) {
    return new Response(JSON.stringify({ ok:false, error:'Cita no encontrada' }), {
      headers: { "Content-Type": "application/json" }, status:404
    });
  }

  const payload = {
    cita_id: row.cita_id, fecha: row.fecha, hora: row.hora,
    sintomas: row.sintomas, asistencia: row.asistencia, movimiento: row.movimiento, estado: row.estado,
    seguro: row.seguro,

    paciente_ci: row.paciente_ci,
    paciente_nombre: `${row.paciente_nombre ?? ''} ${row.paciente_apellido ?? ''}`.trim(),
    telefono: row.paciente_telefono,

    escuela_direccion: row.escuela_direccion,
    escuela_sector: row.escuela_sector,

    direccion: row.direccion,
    zona: row.zona,
    referencia: row.referencia,
    sector: row.sector,

    copago: row.copago, medicina: row.medicina, total: row.total,
    transferido: row.transferido, forma_pago: row.forma_pago, fecha_pago: row.fecha_pago
  };

  return new Response(JSON.stringify({ ok:true, data: payload }), {
    headers: { "Content-Type": "application/json" }
  });
};
