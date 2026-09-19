// Felület-segédek, ikonok, navigáció
export const S = { u: null };          // aktuális felhasználó
export const nav = {};                 // nézetek: név → függvény
let cleanup = null;                    // az aktív nézet takarítója (mikrofon, élő kapcsolat)

export function onLeave(fn) { cleanup = fn; }
export function go(name, ...args) {
  try { cleanup?.(); } catch {}
  cleanup = null;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  nav[name](...args);
  renderTop?.();
}
let renderTop = null;
export function setTop(fn) { renderTop = fn; }

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const app = () => document.getElementById('app');

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function view(html) {
  const el = app();
  el.innerHTML = `<div class="view">${html}</div>`;
  renderTop?.();
  return el.firstElementChild;
}
export function on(root, sel, ev, fn) {
  $$(sel, root).forEach((el) => el.addEventListener(ev, (e) => fn(e, el)));
}

export function loader(msg = 'A Gemini dolgozik…') {
  return `<div class="loader"><div class="spinner"></div><div>${esc(msg)}</div></div>`;
}
export function errorBox(e, retry) {
  const id = 'r' + Math.random().toString(36).slice(2, 7);
  setTimeout(() => { const b = document.getElementById(id); if (b && retry) b.onclick = retry; });
  return `<div class="card center stack"><h3>Hiba történt</h3><p class="muted">${esc(e?.message || e)}</p>
    <div class="row" style="justify-content:center">${retry ? `<button class="btn primary" id="${id}">Újra</button>` : ''}
    <button class="btn ghost" onclick="window.__go('home')">Vissza a főoldalra</button></div></div>`;
}

let tt;
export function toast(msg, ms = 2600) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.remove('on'), ms);
}

export function modal(html) {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="card glow-border stack">${html}</div>`;
  document.body.appendChild(m);
  return { el: m, close: () => m.remove() };
}

export function back(to = 'home', label = 'Vissza') {
  return `<button class="back" onclick="window.__go('${to}')">${I.left} ${label}</button>`;
}

const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export const I = {
  left: svg('<path d="M15 18l-6-6 6-6"/>'),
  right: svg('<path d="M9 18l6-6-6-6"/>'),
  play: svg('<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/><path d="M19 5a10 10 0 010 14"/>'),
  slow: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  mic: svg('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0014 0M12 17v5"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
  book: svg('<path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5v14z"/><path d="M8 7h8M8 11h6"/>'),
  cards: svg('<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 012 2v12"/>'),
  pen: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>'),
  wave: svg('<path d="M2 12h2M6 8v8M10 4v16M14 7v10M18 10v4M22 12h0"/>'),
  chat: svg('<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>'),
  chart: svg('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>'),
  bolt: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>'),
  spark: svg('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/>'),
  check: svg('<path d="M20 6L9 17l-5-5"/>'),
  img: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>'),
  target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  eye: svg('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'),
};

export function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?¿¡;:"'«»„”“’‘()\-–—。、！？]/g, '').replace(/\s+/g, ' ').trim();
}
export function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
export function speakBtn(text, cls = '') {
  return `<button class="btn icon sm ${cls}" data-say="${esc(text)}" title="Meghallgatom">${I.play}</button>`;
}
