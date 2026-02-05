// functions/api/health.js
export const onRequestGet = async () => {
  return new Response(JSON.stringify({ ok: true, time: new Date().toISOString() }), {
    headers: { "Content-Type": "application/json" }
  });
};
