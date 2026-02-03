export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ======================
    // GET → LISTAR CITAS
    // ======================
    if (request.method === "GET") {
      const fecha = url.searchParams.get("fecha");
      if (!fecha) {
        return new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json" }
        });
      }

      const { results } = await env.DB.prepare(`
        SELECT
          c.id,
          c.fecha,
          c.hora,
          c.estado,
          c.sintomas,
          p.ci,
          p.nombre,
          p.apellido,
          d.direccion,
          d.ciudad,
          d.zona,
          d.sector
        FROM cita c
        JOIN paciente p ON p.id = c.paciente_id
        JOIN direccion d ON d.id = c.direccion_id
        WHERE c.fecha = ?
        ORDER BY c.hora
      `).bind(fecha).all();

      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ======================
    // POST → CREAR CITA
    // ======================
    if (request.method === "POST") {
      const body = await request.json();
      const {
        paciente_id,
        direccion_id,
        seguro_id,
        fecha,
        hora,
        sintomas
      } = body;

      if (!paciente_id || !direccion_id || !fecha || !hora) {
        return new Response(
          JSON.stringify({ error: "Datos obligatorios faltantes" }),
          { status: 400 }
        );
      }

      // 🔒 VALIDACIÓN (opción A)
      const existe = await env.DB.prepare(`
        SELECT 1 FROM cita
        WHERE paciente_id = ?
          AND direccion_id = ?
          AND fecha = ?
          AND hora = ?
      `).bind(paciente_id, direccion_id, fecha, hora).first();

      if (existe) {
        return new Response(
          JSON.stringify({
            error: "Ya existe una cita para ese paciente, dirección, fecha y hora."
          }),
          { status: 409 }
        );
      }

      const result = await env.DB.prepare(`
        INSERT INTO cita (
          paciente_id,
          direccion_id,
          seguro_id,
          fecha,
          hora,
          sintomas,
          estado
        ) VALUES (?, ?, ?, ?, ?, ?, 'agendada')
      `).bind(
        paciente_id,
        direccion_id,
        seguro_id ?? null,
        fecha,
        hora,
        sintomas ?? null
      ).run();

      return new Response(JSON.stringify({
        ok: true,
        id: result.lastRowId
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ======================
    // PUT → CAMBIAR ESTADO
    // ======================
    if (request.method === "PUT") {
      const body = await request.json();
      const { cita_id, estado } = body;

      if (!cita_id || !estado) {
        return new Response(
          JSON.stringify({ error: "cita_id y estado requeridos" }),
          { status: 400 }
        );
      }

      await env.DB.prepare(`
        UPDATE cita SET estado = ?
        WHERE id = ?
      `).bind(estado, cita_id).run();

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Method not allowed", { status: 405 });
  }
};

