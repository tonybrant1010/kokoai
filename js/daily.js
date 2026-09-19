// Napi intenzív kör állapota
import { S, go, toast } from './ui.js';
import * as st from './store.js';

// Napi kör: sorrendben végigvezet a modulokon
export const daily = { steps: [], i: -1 };
export function startDaily() {
  const due = st.cardStats(S.u).due;
  daily.steps = [...(due ? ['cards'] : []), 'lesson', 'live'];
  daily.i = 0;
  go(daily.steps[0], { daily: true });
}
export function dailyNext() {
  if (daily.i < 0) return go('home');
  daily.i++;
  if (daily.i >= daily.steps.length) {
    daily.i = -1;
    st.addXP(S.u, 25);
    toast('Napi kör kész! +25 XP bónusz 🎉', 3500);
    return go('home');
  }
  go(daily.steps[daily.i], { daily: true });
}
export function dailyBar() {
  if (daily.i < 0) return '';
  const names = { cards: 'Ismétlés', lesson: 'Lecke', live: 'Beszélgetés' };
  return `<div class="card" style="margin-bottom:16px;padding:12px 16px"><div class="row between"><span class="eyebrow">Napi intenzív kör · ${daily.i + 1}/${daily.steps.length}</span>
    <span class="dim">${daily.steps.map((s, i) => `<span style="${i === daily.i ? 'color:var(--cyan);font-weight:700' : ''}">${names[s]}</span>`).join(' → ')}</span></div></div>`;
}
export function dailyActive() { return daily.i >= 0; }

