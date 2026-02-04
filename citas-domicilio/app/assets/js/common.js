<script>
// Base para producción (Pages). Si pruebas local, cambia a tu URL local.
const BASE = '';

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

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
function setAlert(el, msg, isErr=false) {
  el.textContent = msg; el.classList.toggle('error', isErr);
  el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 3000);
}
</script>