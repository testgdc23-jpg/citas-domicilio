import { setAuthCookie } from './_utils.js';

// POST /api/auth/login { username, password }
export const onRequestPost = async ({ request, env }) => {
  const json = (d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json'}});
  let body; try { body = await request.json(); } catch { return json({ ok:false, error:'JSON inválido' },400); }
  const { username, password } = body || {};
  if (!username || !password) return json({ ok:false, error:'username y password requeridos' },400);

  // Hash sencillo (demo). Para prod usa PBKDF2/Argon2/bcrypt.
  const enc = new TextEncoder();
  const data = enc.encode(`${username}:static_salt:${password}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');

  const row = await env.DB
    .prepare(`SELECT id, username, password_hash, rol, activo FROM USUARIO WHERE username=?`)
    .bind(username)
    .first();

  if (!row || row.activo === 0 || row.password_hash !== hash) {
    return json({ ok:false, error:'Credenciales inválidas' },401);
  }

  const cookie = await setAuthCookie(row, env);
  return new Response(JSON.stringify({ ok:true, user:{ id:row.id, username:row.username, rol:row.rol } }), {
    status:200,
    headers: { 'Content-Type':'application/json', 'Set-Cookie': cookie }
  });
};
