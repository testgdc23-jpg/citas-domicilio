function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      // ======================
      // GET → LISTAR CITAS
      // /api/cita?fecha=YYYY-MM-DD
      // ======================
      if (request.method === "GET") {
        const fecha = (url.searchParams.get("fecha") || "").trim();

        if (!fecha) return json({ error: "Requerido: fecha" }, 400);

        const { results } = await env.DB.prepare(`
          SELECT
            c.id,
            c.paciente_id,
            p.ci,
            p.nombre,
            p.apellido,
            c.direccion_id,
            d.direccion,
            d.ciudad,
            d.zona,
            d.sector,
            c.seguro_id,
            s.nombre AS seguro_nombre,
            c.fecha,
            c.hora,
            c.estado,
            c.sintomas
          FROM cita c
          JOIN paciente p ON p.id = c.paciente_id
          JOIN direccion d ON d.id = c.direccion_id
          LEFT JOIN seguro s ON s.id = c.seguro_id
          WHERE c.fecha = ?
          ORDER BY c.hora
        `).bind(fecha).all();

        return json(results);
      }

      // ======================
      // POST → CREAR CITA
      // ======================
      if (request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return json({ error: "JSON inválido" }, 400);

        const paciente_id = Number(body.paciente_id);
        const direccion_id = Number(body.direccion_id);
        const seguro_id = body.seguro_id == null ? null : Number(body.seguro_id);
        const fecha = (body.fecha || "").trim();
        const hora = (body.hora || "").trim();
        const sintomas = body.sintomas == null ? null : String(body.sintomas);

        if (!paciente_id) return json({ error: "Requerido: paciente_id" }, 400);
        if (!direccion_id) return json({ error: "Requerido: direccion_id" }, 400);
        if (!fecha) return json({ error: "Requerido: fecha" }, 400);
        if (!hora) return json({ error: "Requerido: hora" }, 400);

        // Validar que la dirección exista (y opcionalmente que sea del paciente)
        const dir = await env.DB.prepare(`
          SELECT id, paciente_id FROM direccion WHERE id = ?
        `).bind(direccion_id).first();

        if (!dir) return json({ error: "Dirección no existe" }, 409);
        if (Number(dir.paciente_id) !== paciente_id) {
          return json({ error: "La dirección no pertenece al paciente" }, 409);
        }

        // Evitar duplicados (opción A)
        const existe = await env.DB.prepare(`
          SELECT id FROM cita
          WHERE paciente_id = ?
            AND direccion_id = ?
            AND fecha = ?
            AND hora = ?
          LIMIT 1
        `).bind(paciente_id, direccion_id, fecha, hora).first();

        if (existe) {
          return json({ error: "Ya existe una cita para ese paciente, dirección, fecha y hora." }, 409);
        }

        const result = await env.DB.prepare(`
          INSERT INTO cita (paciente_id, direccion_id, seguro_id, fecha, hora, sintomas, estado)
          VALUES (?, ?, ?, ?, ?, ?, 'agendada')
        `).bind(paciente_id, direccion_id, seguro_id, fecha, hora, sintomas).run();

        return json({ ok: true, id: result.lastRowId });
      }

      // ======================
      // PUT → CAMBIAR ESTADO
      // ======================
      if (request.method === "PUT") {
        const body = await request.json().catch(() => null);
        if (!body) return json({ error: "JSON inválido" }, 400);

        const cita_id = Number(body.cita_id);
        const estado = (body.estado || "").trim();
        const valid = ["agendada", "confirmada", "atendida", "cancelada"];

        if (!cita_id) return json({ error: "Requerido: cita_id" }, 400);
        if (!valid.includes(estado)) return json({ error: "Estado inválido" }, 400);

        await env.DB.prepare(`UPDATE cita SET estado = ? WHERE id = ?`)
          .bind(estado, cita_id)
          .run();

        return json({ ok: true });
      }

      return json({ error: "Método no permitido" }, 405);

    } catch (err) {
      // Si algo se rompe, igual devolvemos JSON (esto arregla tu mensaje horrible)
      return new Response(JSON.stringify({ error: String(err.message || err) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
};
