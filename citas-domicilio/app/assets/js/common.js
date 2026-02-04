// /app/assets/js/common.js
const BASE = ''; // en producción, vacío. Si pruebas local, pon 'http://127.0.0.1:8788'

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Error HTTP ${res.status}`);
  }
  return data;
}

function setAlert(el, msg, isErr=false) {
  el.textContent = msg;
  el.classList.toggle('error', isErr);
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}
