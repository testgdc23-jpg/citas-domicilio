// /app/assets/js/common.js
const BASE = ''; // en producción, vacío

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    if (/^\s*<!doctype|^\s*<html/i.test(text)) {
      throw new Error(`La URL ${path} devolvió HTML (posible 404/500 en Functions).`);
    }
    throw new Error(`Respuesta no JSON desde ${path}: ${text.slice(0, 120)}...`);
  }

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
