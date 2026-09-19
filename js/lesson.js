// Személyre szabott lecke: bemenet → nyelvtan → gyakorlás → kiejtés → írás → összegzés
import { S, nav, go, view, on, $, $$, esc, loader, errorBox, toast, back, I, speakBtn, normalize, shuffle } from './ui.js';
import * as st from './store.js';
import { genJSON } from './api.js';
import * as P from './prompts.js';
import { feedbackHTML, shadow } from './components.js';
import { dailyBar, dailyNext, dailyActive } from './daily.js';

nav.lesson = async (opts = {}) => {
  const u = S.u, c = st.course(u);
  if (c.pending && !opts.fresh) return play(c.pending);
  view(dailyBar() + loader('A Gemini összeállítja a személyre szabott leckédet…'));
  try {
    const L = await genJSON(P.lesson(u, c));
    if (!L.text?.length || !L.exercises?.length) throw new Error('Hiányos lecke érkezett.');
    L.step = 0; L.results = []; L.ex = 0;
    c.pending = L; st.save();
    play(L);
  } catch (e) { view(errorBox(e, () => nav.lesson(opts))); }
};

const STEPS = ['Cél', 'Szöveg', 'Nyelvtan', 'Gyakorlás', 'Kiejtés', 'Írás', 'Kész'];

function frame(L, body, { next = 'Tovább', canNext = true } = {}) {
  const root = view(`${dailyBar()}${back()}
    <div class="steps">${STEPS.map((s, i) => `<i class="${i <= L.step ? 'on' : ''}" title="${s}"></i>`).join('')}</div>
    <div class="row between"><span class="eyebrow">${STEPS[L.step]} · ${esc(L.title)}</span>
      ${L.step === 0 ? `<button class="btn sm ghost" id="fresh">Másik lecke</button>` : ''}</div>
    <div class="card glow-border" style="margin-top:12px">${body}
      <div class="row end" style="margin-top:20px"><button class="btn primary" id="nx" ${canNext ? '' : 'disabled'}>${next} ${I.right}</button></div></div>`);
  $('#fresh', root)?.addEventListener('click', () => { st.course(S.u).pending = null; st.save(); nav.lesson({ fresh: true }); });
  $('#nx', root).onclick = () => { L.step++; st.save(); play(L); };
  return root;
}

function play(L) {
  const u = S.u, c = st.course(u);
  switch (L.step) {
    case 0: {
      const root = frame(L, `<h2>${esc(L.title)}</h2><p class="muted">${esc(L.goal_hu || '')}</p>
        <h3 style="margin-top:20px">Kulcskifejezések</h3>
        <div class="vocab">${(L.vocab || []).map((v, i) => `<div class="v"><div class="row between"><b>${esc(v.term)}</b><span>${speakBtn(v.term)}</span></div>
          <div class="muted">${esc(v.hu)}</div><div class="dim" style="margin-top:6px">${esc(v.example)}</div><div data-imgout="${i}"></div></div>`).join('')}</div>`,
        { next: 'Kezdjük' });
      break;
    }
    case 1: {
      const root = frame(L, `<div class="row between"><h3>Olvasd és hallgasd meg</h3>
          <div class="row"><button class="btn sm" id="all">${I.play} Mind</button><button class="btn sm" id="tr">${I.eye} Fordítás</button></div></div>
        <p class="dim">Először fordítás nélkül próbáld megérteni – a kontextusból kikövetkeztetett jelentés jobban rögzül.</p>
        <div class="dialog hide-hu" id="dlg">${L.text.map((l) => `<div class="ln">${l.speaker ? `<span class="sp">${esc(l.speaker)}</span>` : ''}
          <div style="flex:1"><div class="t">${esc(l.line)}</div><div class="h">${esc(l.hu)}</div></div>${speakBtn(l.line)}</div>`).join('')}</div>`);
      $('#tr', root).onclick = () => $('#dlg', root).classList.toggle('hide-hu');
      $('#all', root).onclick = async () => { for (const b of $$('#dlg [data-say]', root)) { if (!document.body.contains(b)) break; b.click(); await waitIdle(b); } };
      break;
    }
    case 2: {
      const g = L.grammar || {};
      frame(L, `<h3>${esc(g.title || 'Nyelvtan')}</h3><p>${esc(g.explanation_hu || '')}</p>
        <div class="dialog">${(g.examples || []).map((x) => `<div class="ln"><div style="flex:1"><div class="t">${esc(x.t)}</div><div class="h">${esc(x.hu)}</div></div>${speakBtn(x.t)}</div>`).join('')}</div>`);
      break;
    }
    case 3: return exercise(L);
    case 4: {
      const items = L.speaking || [];
      L.sp = L.sp || 0;
      const it = items[L.sp];
      if (!it) { L.step++; return play(L); }
      const root = frame(L, `<div class="dim center">Árnyékolás ${L.sp + 1}/${items.length}</div><div id="sh"></div>`,
        { next: L.sp + 1 < items.length ? 'Következő mondat' : 'Tovább az íráshoz' });
      shadow($('#sh', root), it, (sc) => { L.results.push({ k: 'beszed', ok: sc >= 70 }); st.addXP(u, 5, 1); });
      $('#nx', root).onclick = () => { L.sp++; if (L.sp >= items.length) L.step++; st.save(); play(L); };
      break;
    }
    case 5: {
      const w = L.writing || { prompt_hu: 'Írj néhány mondatot a lecke témájáról.', min_words: 30 };
      const root = frame(L, `<h3>${esc(w.prompt_hu)}</h3><p class="dim">Legalább ${w.min_words} szó. Használd a lecke kifejezéseit!</p>
        <textarea id="w" placeholder="Írj ide…"></textarea><div class="row between"><span class="dim" id="wc">0 szó</span>
        <div class="row"><button class="btn ghost sm" id="skip">Kihagyom</button><button class="btn" id="chk">${I.check} Ellenőrzés</button></div></div><div id="fb"></div>`,
        { next: 'Összegzés', canNext: false });
      const ta = $('#w', root);
      ta.oninput = () => { $('#wc', root).textContent = (ta.value.trim().match(/\S+/g) || []).length + ' szó'; };
      $('#skip', root).onclick = () => { L.step++; play(L); };
      $('#chk', root).onclick = async () => {
        if (ta.value.trim().length < 10) return toast('Írj egy kicsit többet!');
        $('#chk', root).disabled = true;
        $('#fb', root).innerHTML = loader('Javítás…');
        try {
          const fb = await genJSON(P.writingFeedback(u.current, c.level, w.prompt_hu, ta.value));
          $('#fb', root).innerHTML = `<hr/>${feedbackHTML(fb)}`;
          st.setSkill(u, 'iras', +fb.score || 0);
          st.addWeaknesses(u, fb.weaknesses);
          L.results.push({ k: 'iras', ok: (+fb.score || 0) >= 70 });
          st.addXP(u, 15, 3);
          $('#nx', root).disabled = false;
        } catch (e) { $('#fb', root).innerHTML = `<p class="muted">Hiba: ${esc(e.message)}</p>`; $('#chk', root).disabled = false; }
      };
      break;
    }
    default: return summary(L);
  }
}

function waitIdle(btn) {
  return new Promise((res) => { const t = setInterval(() => { if (!btn.classList.contains('ok')) { clearInterval(t); res(); } }, 150); });
}

function exercise(L) {
  const u = S.u, c = st.course(u);
  const ex = L.exercises[L.ex];
  if (!ex) { L.step++; st.save(); return play(L); }
  const n = `${L.ex + 1}/${L.exercises.length}`;
  let body = `<div class="dim">Feladat ${n}</div>`;
  if (ex.type === 'mc') {
    body += `<div class="q">${esc(ex.q)}</div><div class="opts">${ex.options.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>`;
  } else if (ex.type === 'cloze') {
    body += `<div class="q">${esc(ex.q).replace(/_{2,}/g, '<span class="grad">____</span>')}</div><p class="muted">${esc(ex.hu || '')}</p>
      <form id="cf" class="row"><input class="input" id="ans" autocomplete="off" autocapitalize="off" style="flex:1" placeholder="Hiányzó szó"/><button class="btn">${I.check}</button></form>`;
  } else if (ex.type === 'order') {
    body += `<div class="q">Rakd sorba: <span class="muted">${esc(ex.hu)}</span></div><div class="answerline words" id="line"></div><div class="words" id="pool">
      ${shuffle(String(ex.answer).split(/\s+/)).map((w, i) => `<button class="word" data-w="${i}">${esc(w)}</button>`).join('')}</div>
      <div class="row end" style="margin-top:12px"><button class="btn sm ghost" id="reset">Újra</button><button class="btn" id="ok">${I.check} Ellenőrzés</button></div>`;
  } else {
    body += `<div class="q">Fordítsd le: <span class="muted">${esc(ex.hu)}</span></div>
      <form id="cf" class="stack"><input class="input" id="ans" autocomplete="off" placeholder="Fordítás"/><div class="row end"><button class="btn">${I.check} Ellenőrzés</button></div></form>`;
  }
  body += `<div id="fb"></div>`;
  const root = frame(L, body, { next: L.ex + 1 < L.exercises.length ? 'Következő' : 'Tovább', canNext: false });
  const done = (ok, extra = '') => {
    L.results.push({ k: ex.type === 'mc' ? 'nyelvtan' : 'szokincs', ok });
    if (ok) st.addXP(u, 5, 1);
    $('#fb', root).innerHTML = `<div class="fb ${ok ? 'good' : 'bad'}"><b class="${ok ? 'g' : 'r'}">${ok ? 'Helyes!' : 'Nem egészen.'}</b>
      ${ex.type !== 'mc' ? ` Megoldás: <b>${esc(ex.answer)}</b> ${speakBtn(ex.type === 'cloze' ? ex.q.replace(/_{2,}/g, ex.answer) : ex.answer)}` : ''}
      ${extra}<div class="dim" style="margin-top:6px">${esc(ex.explain_hu || '')}</div></div>`;
    $('#nx', root).disabled = false;
    $('#nx', root).focus();
    $('#nx', root).onclick = () => { L.ex++; st.save(); exercise(L); };
  };
  if (ex.type === 'mc') {
    on(root, '.opt', 'click', (e, b) => {
      const i = +b.dataset.i;
      $$('.opt', root).forEach((x, j) => { x.disabled = true; if (j === ex.answer) x.classList.add('right'); else if (j === i) x.classList.add('wrong'); });
      done(i === ex.answer);
    });
  } else if (ex.type === 'order') {
    const line = $('#line', root), pool = $('#pool', root);
    on(root, '.word', 'click', (e, b) => { (b.parentElement === pool ? line : pool).appendChild(b); });
    $('#reset', root).onclick = () => $$('.word', line).forEach((b) => pool.appendChild(b));
    $('#ok', root).onclick = () => {
      const got = $$('.word', line).map((b) => b.textContent).join(' ');
      $('#ok', root).disabled = true;
      done(normalize(got) === normalize(ex.answer));
    };
  } else {
    const inp = $('#ans', root); inp.focus();
    $('#cf', root).onsubmit = async (e) => {
      e.preventDefault();
      const v = inp.value.trim(); if (!v) return;
      inp.disabled = true;
      if (ex.type === 'cloze') {
        const ok = [ex.answer, ...(ex.accept || [])].some((a) => normalize(a) === normalize(v));
        return done(ok);
      }
      if (normalize(v) === normalize(ex.answer)) return done(true);
      $('#fb', root).innerHTML = loader('Ellenőrzés…');
      try {
        const j = await genJSON(P.judgeTranslate(u.current, c.level, ex.hu, ex.answer, v));
        if (j.weakness) st.addWeaknesses(u, [j.weakness]);
        done(!!j.correct, `<div style="margin-top:6px">${esc(j.explain_hu || '')}${j.better ? ` <br/>Még jobb: <b>${esc(j.better)}</b>` : ''}</div>`);
      } catch { done(false); }
    };
  }
}

function summary(L) {
  const u = S.u, c = st.course(u);
  const ok = L.results.filter((r) => r.ok).length, tot = L.results.length || 1;
  const pct = Math.round((ok / tot) * 100);
  const added = st.addCards(u, L.vocab, L.title);
  c.topics.push(L.topic || L.title);
  c.topics = c.topics.slice(-40);
  const byK = (k) => { const a = L.results.filter((r) => r.k === k); return a.length ? Math.round(a.filter((r) => r.ok).length / a.length * 100) : null; };
  for (const k of ['nyelvtan', 'szokincs']) { const v = byK(k); if (v != null) st.setSkill(u, k, v); }
  st.setSkill(u, 'olvasas', Math.max(40, pct));
  st.addXP(u, 20, pct >= 70 ? 8 : 4);
  st.logActivity(u, 'lecke', L.title, pct);
  c.pending = null; st.save();
  const root = view(`${dailyBar()}<div class="card glow-border center stack" style="max-width:600px;margin:3vh auto">
    <span class="eyebrow">Lecke kész</span><h2>${esc(L.title)}</h2>
    <div class="ring" style="--p:${pct};margin:0 auto"><div><span>${pct}%</span><small>pontosság</small></div></div>
    <p class="muted">${added} új kifejezés került a szókártyáid közé. Szintlépési haladás: ${c.progress}%.</p>
    <div class="row" style="justify-content:center">
      ${dailyActive() ? `<button class="btn primary lg" id="nx">Tovább a napi körben ${I.right}</button>` :
      `<button class="btn" id="h">Főoldal</button><button class="btn primary" id="again">Következő lecke ${I.right}</button>`}
    </div></div>`);
  $('#nx', root)?.addEventListener('click', dailyNext);
  $('#h', root)?.addEventListener('click', () => go('home'));
  $('#again', root)?.addEventListener('click', () => nav.lesson({ fresh: true }));
}
