// Felhasználók és haladás a böngészőben (localStorage), felhasználónevenként.
import { LEVELS } from './data.js';

const KEY = 'kokoai.users.v1';
const LAST = 'kokoai.last';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
let db = load();
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn('mentés', e); }
}

export const today = () => new Date().toISOString().slice(0, 10);
const norm = (n) => n.trim().toLowerCase();

export function users() {
  return Object.values(db).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
}
export function lastUser() {
  try { const n = localStorage.getItem(LAST); return n && db[norm(n)] ? db[norm(n)] : null; } catch { return null; }
}
export function login(name) {
  const k = norm(name);
  if (!db[k]) {
    db[k] = { name: name.trim(), created: Date.now(), langs: {}, current: null, goal: 'altalanos',
      dailyMin: 20, voice: 'Kore', streak: { count: 0, last: null }, daily: { date: today(), xp: 0 } };
  }
  db[k].lastSeen = Date.now();
  try { localStorage.setItem(LAST, db[k].name); } catch {}
  save();
  return db[k];
}
export function logout() { try { localStorage.removeItem(LAST); } catch {} }
export function removeUser(name) { delete db[norm(name)]; save(); }

export function course(u, code = u.current) {
  if (!code) return null;
  if (!u.langs[code]) {
    u.langs[code] = { level: null, progress: 0, xp: 0, placement: null, weaknesses: [], topics: [],
      cards: [], history: [], skills: { szokincs: 0, nyelvtan: 0, olvasas: 0, iras: 0, beszed: 0, hallas: 0 } };
  }
  return u.langs[code];
}

// XP + napi sorozat + szintlépési haladás
export function addXP(u, xp, progress = 0) {
  const c = course(u);
  const t = today();
  if (u.daily.date !== t) u.daily = { date: t, xp: 0 };
  u.daily.xp += xp;
  c.xp += xp;
  if (u.streak.last !== t) {
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    u.streak.count = u.streak.last === y ? u.streak.count + 1 : 1;
    u.streak.last = t;
  }
  c.progress = Math.max(0, Math.min(100, c.progress + progress));
  save();
}
export function logActivity(u, type, title, score) {
  const c = course(u);
  c.history.unshift({ t: Date.now(), type, title, score });
  c.history = c.history.slice(0, 80);
  save();
}
export function setSkill(u, skill, score) {
  const c = course(u);
  const old = c.skills[skill] || 0;
  c.skills[skill] = Math.round(old ? old * 0.7 + score * 0.3 : score);
  save();
}
export function addWeaknesses(u, list) {
  const c = course(u);
  for (const w of list || []) {
    if (!w) continue;
    const ex = c.weaknesses.find((x) => x.k.toLowerCase() === w.toLowerCase());
    if (ex) { ex.n++; ex.t = Date.now(); } else c.weaknesses.push({ k: w, n: 1, t: Date.now() });
  }
  c.weaknesses.sort((a, b) => b.n - a.n || b.t - a.t);
  c.weaknesses = c.weaknesses.slice(0, 20);
  save();
}
export function nextLevel(level) {
  const i = LEVELS.indexOf(level);
  return LEVELS[Math.min(LEVELS.length - 1, i + 1)];
}

// ---- Térközös ismétlés (SM-2 egyszerűsítve) ----
export function addCards(u, items, source = '') {
  const c = course(u);
  let added = 0;
  for (const it of items || []) {
    if (!it?.term) continue;
    if (c.cards.some((x) => x.term.toLowerCase() === it.term.toLowerCase())) continue;
    c.cards.push({ id: Math.random().toString(36).slice(2, 10), term: it.term, hu: it.hu || '', ex: it.example || '',
      exHu: it.ex_hu || '', source, ease: 2.5, ivl: 0, reps: 0, lapses: 0, due: Date.now() });
    added++;
  }
  save();
  return added;
}
export function dueCards(u, limit = 20) {
  const c = course(u);
  const now = Date.now();
  return c.cards.filter((x) => x.due <= now).sort((a, b) => a.due - b.due).slice(0, limit);
}
// grade: 1 = újra, 3 = nehéz, 4 = jó, 5 = könnyű
export function review(u, card, grade) {
  if (grade < 3) {
    card.reps = 0; card.lapses++; card.ivl = 0;
    card.due = Date.now() + 60 * 1000; // egy perc múlva újra
  } else {
    card.reps++;
    card.ivl = card.reps === 1 ? 1 : card.reps === 2 ? (grade === 5 ? 4 : 3) : Math.round(card.ivl * card.ease * (grade === 3 ? 0.8 : grade === 5 ? 1.3 : 1));
    card.due = Date.now() + card.ivl * 864e5;
  }
  card.ease = Math.max(1.3, card.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  save();
}
export function cardStats(u) {
  const c = course(u);
  const now = Date.now();
  return {
    total: c.cards.length,
    due: c.cards.filter((x) => x.due <= now).length,
    learned: c.cards.filter((x) => x.ivl >= 21).length,
  };
}
