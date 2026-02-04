// /app/assets/js/common.js
const BASE = ''; // En producción (Pages), déjalo vacío. En local podrías usar 'http://127.0.0.1:8788' si corres wrangler pages dev.

async function api(path, options = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  // Leemos texto para poder diagnosticar si viene HTML por error
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // Si devuelve HTML, probablemente es un 404/500 de Pages/Functions
    if (/^\s*<!doctype|^\s*<html/i.test(text)) {
      console.error('La URL devolvió HTML:', url, 'status:', res.status, 'sample:', text.slice(0, 200));
      throw new Error(`La URL ${path} devolvió HTML (posible 404/500 en Functions).`);
    }
    console.error('Respuesta no JSON:', url, 'status:', res.status, 'sample:', text.slice(0, 200));
    throw new Error(`Respuesta no JSON desde ${path}: ${text.slice(0, 120)}...`);
  }

  if (!res.ok || data.ok === false) {
    console.error('API error:', url, 'status:', res.status, 'payload:', data);
    throw new Error(data.error || `Error HTTP ${res.status}`);
  }
  return data;
}

function setAlert(el, msg, isErr=false) {
  el.textContent = msg;
  el.classList.toggle('error', isErr);
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4000);
}
