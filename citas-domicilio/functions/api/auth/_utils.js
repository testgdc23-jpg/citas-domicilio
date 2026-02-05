async function sign(data, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function verify(data, secret, signature) {
  const recalculated = await sign(data, secret);
  return signature === recalculated;
}

export async function setAuthCookie(user, env) {
  const payload = JSON.stringify({ id:user.id, username:user.username, rol:user.rol, ts:Date.now() });
  const sig = await sign(payload, env.AUTH_SECRET);
  const cookie = `auth=${btoa(payload)}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
  return cookie;
}

export async function getUserFromCookie(ctx) {
  const { request, env } = ctx;
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)auth=([^;]+)/);
  if (!m) return null;
  const [payloadB64, sig] = decodeURIComponent(m[1]).split('.');
  try {
    const payloadJson = atob(payloadB64);
    const ok = await verify(payloadJson, env.AUTH_SECRET, sig);
    if (!ok) return null;
    const payload = JSON.parse(payloadJson);
    const row = await env.DB
      .prepare(`SELECT id, username, rol, activo FROM USUARIO WHERE id=?`)
      .bind(payload.id)
      .first();
    if (!row || row.activo === 0) return null;
    return row;
  } catch { return null; }
}
