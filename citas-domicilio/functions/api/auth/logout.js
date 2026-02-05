// POST /api/auth/logout
export const onRequestPost = async () => {
  return new Response(JSON.stringify({ ok:true }), {
    headers: {
      'Content-Type':'application/json',
      'Set-Cookie': 'auth=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax'
    }
  });
};
