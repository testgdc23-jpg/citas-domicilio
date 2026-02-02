if (request.method === "GET") {
  const url = new URL(request.url);
  const ci = (url.searchParams.get("ci") ?? "").trim();

  if (ci) {
    const { results } = await env.DB
      .prepare("SELECT id, ci, nombre, apellido, telefono FROM paciente WHERE ci = ? LIMIT 1")
      .bind(ci)
      .all();

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { results } = await env.DB
    .prepare("SELECT id, ci, nombre, apellido, telefono FROM paciente ORDER BY id DESC")
    .all();

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
}
