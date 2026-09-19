// Szókártyák (SRS), írás, kiejtés és szabad beszéd
import { S, nav, go, view, on, $, $$, esc, loader, errorBox, toast, back, I, speakBtn, normalize } from './ui.js';
import * as st from './store.js';
import { genJSON, gen, Recorder } from './api.js';
import * as P from './prompts.js';
import { feedbackHTML, shadow } from './components.js';
import { dailyBar, dailyNext, dailyActive } from './daily.js';

// ---------------- Szókártyák ----------------
nav.cards = () => {
  const u = S.u;
  const queue = st.dueCards(u, 25);
  const stats = st.cardStats(u);
  if (!queue.length) {
    const root = view(`${dailyBar()}${back()}<div class="card glow-border center stack" style="max-width:560px;margin:3vh auto">
      <div class="ico" style="margin:0 auto">${I.cards}</div><h2>Nincs esedékes kártya</h2>
      <p class="muted">${stats.total ? `${stats.total} kifejezés a gyűjteményben, ${stats.learned} már hosszú távon bevésve.` : 'A leckék kulcskifejezései automatikusan ide kerülnek.'}</p>
      <form id="add" class="row"><input class="input" id="w" style="flex:1" placeholder="Saját szó felvétele (célnyelven)"/><button class="btn">Hozzáadás</button></form>
      <div class="row" style="justify-content:center">${dailyActive() ? `<button class="btn primary" id="nx">Tovább ${I.right}</button>` : `<button class="btn primary" id="l">Új lecke</button>`}</div></div>`);
    $('#nx', root)?.addEventListener('click', dailyNext);
    $('#l', root)?.addEventListener('click', () => go('lesson'));
    $('#add', root).onsubmit = (e) => { e.preventDefault(); addWord($('#w', root).value.trim(), $('#add', root)); };
    return;
  }
  let i = 0, right = 0;
  const show = () => {
    const card = queue[i];
    if (!card) return finish();
    const typed = card.reps % 2 === 0; // váltakozva: aktív előhívás (gépelés) és felismerés
    const root = view(`${dailyBar()}${back()}
      <div class="row between"><span class="eyebrow">Szókártyák · ${i + 1}/${queue.length}</span><span class="dim">${typed ? 'Írd le célnyelven' : 'Mit jelent?'}</span></div>
      <div class="progress" style="margin:10px 0 16px"><i style="width:${(i / queue.length) * 100}%"></i></div>
      <div class="card glow-border flash">
        ${typed ? `<div class="front">${esc(card.hu)}</div>${card.exHu ? `<div class="dim">${esc(card.exHu)}</div>` : ''}
          <form id="tf" class="row" style="width:100%;max-width:420px"><input class="input" id="ans" autocomplete="off" autocapitalize="off" style="flex:1"/><button class="btn">${I.check}</button></form>`
        : `<div class="front">${esc(card.term)}</div><div>${speakBtn(card.term)}</div><button class="btn" id="show">Mutasd a jelentést</button>`}
        <div id="back" hidden class="stack">
          <div class="backs"><b>${esc(card.term)}</b> ${speakBtn(card.term)} — ${esc(card.hu)}</div>
          ${card.ex ? `<div class="muted">${esc(card.ex)} ${speakBtn(card.ex)}</div>` : ''}
          <div id="verdict"></div>
        </div>
      </div>
      <div class="grades" id="gr" hidden style="margin-top:14px">
        <button class="btn bad" data-g="1">Újra<small>&lt; 1 perc</small></button>
        <button class="btn" data-g="3">Nehéz<small>${card.reps ? Math.max(1, Math.round(card.ivl * card.ease * 0.8)) : 1} nap</small></button>
        <button class="btn ok" data-g="4">Jó<small>${card.reps ? Math.max(1, Math.round(card.ivl * card.ease)) : 1} nap</small></button>
        <button class="btn" data-g="5">Könnyű<small>${card.reps ? Math.max(2, Math.round(card.ivl * card.ease * 1.3)) : 4} nap</small></button>
      </div>`);
    const reveal = (suggest) => {
      $('#back', root).hidden = false; $('#gr', root).hidden = false;
      if (suggest) $(`[data-g="${suggest}"]`, root).style.boxShadow = '0 0 0 2px var(--cyan)';
    };
    if (typed) {
      $('#ans', root).focus();
      $('#tf', root).onsubmit = (e) => {
        e.preventDefault();
        const v = $('#ans', root).value;
        const ok = normalize(v) === normalize(card.term);
        const close = !ok && lev(normalize(v), normalize(card.term)) <= 2;
        $('#verdict', root).innerHTML = ok ? '<b style="color:var(--green)">Pontosan!</b>' : close ? '<b style="color:var(--amber)">Majdnem – apró eltérés.</b>' : '<b style="color:var(--red)">Nem egészen.</b>';
        $('#ans', root).disabled = true;
        reveal(ok ? 4 : close ? 3 : 1);
      };
    } else $('#show', root).onclick = (e) => { e.target.remove(); reveal(); };
    on(root, '[data-g]', 'click', (e, b) => {
      const g = +b.dataset.g;
      st.review(u, card, g);
      if (g >= 3) { right++; st.addXP(u, 2, 0.3); } else queue.push(card);
      i++; show();
    });
  };
  const finish = () => {
    st.setSkill(u, 'szokincs', Math.round((right / Math.max(1, i)) * 100));
    st.logActivity(u, 'ismétlés', `Szókártyák (${right} helyes)`, Math.round((right / Math.max(1, i)) * 100));
    if (dailyActive()) return dailyNext();
    toast(`Kész! ${right} kártya ismételve.`);
    go('home');
  };
  show();
};
async function addWord(w, form) {
  if (!w) return;
  const u = S.u, c = st.course(u);
  form.querySelector('button').disabled = true;
  try {
    const j = await genJSON(P.wordLookup(u.current, w, c.level));
    st.addCards(u, [j], 'saját');
    toast(`Felvéve: ${j.term} – ${j.hu}`);
    nav.cards();
  } catch (e) { toast('Hiba: ' + e.message); form.querySelector('button').disabled = false; }
}
function lev(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}

// ---------------- Írás ----------------
nav.writing = async () => {
  const u = S.u, c = st.course(u);
  view(loader('Írásfeladat készül…'));
  let t;
  try { t = await genJSON(P.writingTask(u, c)); } catch (e) { return view(errorBox(e, nav.writing)); }
  const root = view(`${back()}<span class="eyebrow">Írás · ${c.level}</span>
    <div class="card glow-border stack" style="margin-top:12px">
      <h2 style="font-size:22px">${esc(t.prompt_hu)}</h2>
      ${t.hints?.length ? `<div class="row" style="gap:8px">${t.hints.map((h) => `<span class="pill">${esc(h)}</span>`).join('')}</div>` : ''}
      <textarea id="w" placeholder="Legalább ${t.min_words} szó…"></textarea>
      <div class="row between"><span class="dim" id="wc">0 szó</span>
        <div class="row"><button class="btn ghost sm" id="new">Másik feladat</button><button class="btn" id="deep" title="Részletesebb elemzés">${I.spark} Mélyelemzés</button><button class="btn primary" id="chk">${I.check} Javítás</button></div></div>
      <div id="fb"></div>
    </div>`);
  const ta = $('#w', root);
  ta.oninput = () => { $('#wc', root).textContent = (ta.value.trim().match(/\S+/g) || []).length + ' szó'; };
  $('#new', root).onclick = nav.writing;
  const check = async (deep) => {
    if (ta.value.trim().length < 10) return toast('Írj egy kicsit többet!');
    $('#fb', root).innerHTML = loader(deep ? 'Mélyelemzés…' : 'Javítás…');
    try {
      const fb = await genJSON(P.writingFeedback(u.current, c.level, t.prompt_hu, ta.value, deep));
      $('#fb', root).innerHTML = `<hr/>${feedbackHTML(fb)}`;
      st.setSkill(u, 'iras', +fb.score || 0);
      st.addWeaknesses(u, fb.weaknesses);
      st.addXP(u, 20, (+fb.score || 0) >= 70 ? 5 : 2);
      st.logActivity(u, 'írás', t.prompt_hu.slice(0, 60), +fb.score || 0);
    } catch (e) { $('#fb', root).innerHTML = `<p class="muted">Hiba: ${esc(e.message)}</p>`; }
  };
  $('#chk', root).onclick = () => check(false);
  $('#deep', root).onclick = () => check(true);
};

// ---------------- Kiejtés + szabad beszéd ----------------
nav.speaking = async (opts = {}) => {
  const u = S.u, c = st.course(u);
  const root = view(`${dailyBar()}${back()}<span class="eyebrow">Beszéd · ${c.level}</span>
    <div class="seg" style="margin:12px 0 16px"><button class="on" data-t="shadow">Árnyékolás (kiejtés)</button><button data-t="free">Szabad beszéd</button></div>
    <div id="body"></div>
    ${dailyActive() ? `<div class="row end" style="margin-top:16px"><button class="btn primary" id="nx">Tovább a napi körben ${I.right}</button></div>` : ''}`);
  $('#nx', root)?.addEventListener('click', dailyNext);
  const body = $('#body', root);
  const tabs = { shadow: () => shadowTab(body), free: () => freeTab(body) };
  on(root, '[data-t]', 'click', (e, b) => { $$('[data-t]', root).forEach((x) => x.classList.toggle('on', x === b)); tabs[b.dataset.t](); });
  shadowTab(body);
};

async function shadowTab(body) {
  const u = S.u, c = st.course(u);
  body.innerHTML = loader('Mondatok előkészítése…');
  let items;
  try { items = (await genJSON(P.shadowSentences(u.current, c.level, c.topics.at(-1)))).items || []; }
  catch (e) { body.innerHTML = errorBox(e, () => shadowTab(body)); return; }
  let i = 0; const scores = [];
  const show = () => {
    if (!items[i]) {
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length));
      st.logActivity(u, 'kiejtés', 'Árnyékolás', avg);
      body.innerHTML = `<div class="card center stack"><h3>Kész!</h3><div class="score grad">${avg || '–'}</div><p class="muted">átlagos kiejtési pontszám</p>
        <div class="row" style="justify-content:center"><button class="btn primary" id="more">Új mondatok</button></div></div>`;
      $('#more', body).onclick = () => shadowTab(body);
      return;
    }
    body.innerHTML = `<div class="card glow-border"><div class="dim center">Mondat ${i + 1}/${items.length}</div><div id="sh"></div>
      <div class="row end" style="margin-top:12px"><button class="btn" id="nx2">Következő ${I.right}</button></div></div>`;
    shadow($('#sh', body), items[i], (sc) => { scores.push(sc); st.addXP(u, 5, 1); });
    $('#nx2', body).onclick = () => { i++; show(); };
  };
  show();
}

async function freeTab(body) {
  const u = S.u, c = st.course(u);
  body.innerHTML = loader('Beszédtéma készül…');
  let t;
  try { t = await genJSON(P.speakingTopic(u, c)); } catch (e) { body.innerHTML = errorBox(e, () => freeTab(body)); return; }
  body.innerHTML = `<div class="card glow-border stack center">
    <h3>${esc(t.task_hu)}</h3><div class="muted">${esc(t.task || '')} ${t.task ? speakBtn(t.task) : ''}</div>
    ${t.hints?.length ? `<div class="row" style="justify-content:center;gap:8px">${t.hints.map((h) => `<span class="pill">${esc(h)}</span>`).join('')}</div>` : ''}
    <div class="row" style="justify-content:center;margin-top:8px"><button class="mic" id="rec">${I.mic}</button></div>
    <div class="dim" id="hint">Nyomd meg, és beszélj 30–60 másodpercig. Még egy nyomás: kész.</div>
    <div id="out" style="text-align:left"></div>
    <div class="row" style="justify-content:center"><button class="btn ghost sm" id="new">Másik téma</button></div></div>`;
  $('#new', body).onclick = () => freeTab(body);
  const btn = $('#rec', body), hint = $('#hint', body), out = $('#out', body);
  let rec = null, timer;
  btn.onclick = async () => {
    if (!rec) {
      rec = new Recorder();
      try { await rec.start((l) => btn.style.setProperty('--lvl', Math.min(1, l * 3))); }
      catch (e) { rec = null; hint.textContent = 'Nincs mikrofon: ' + e.message; return; }
      btn.classList.add('rec'); btn.innerHTML = I.stop;
      const t0 = Date.now();
      timer = setInterval(() => { const s = Math.round((Date.now() - t0) / 1000); hint.textContent = `Felvétel… ${s} mp`; if (s >= 90) btn.click(); }, 500);
      return;
    }
    clearInterval(timer);
    const r = rec; rec = null;
    btn.classList.remove('rec'); btn.innerHTML = I.mic; btn.style.setProperty('--lvl', 0);
    const wav = await r.stop();
    if (r.seconds < 1) { hint.textContent = 'Túl rövid.'; return; }
    out.innerHTML = loader('Átirat…');
    try {
      const { text } = await gen(P.transcribe(u.current, wav));
      out.innerHTML = `<div class="fb"><b>Átirat:</b> ${esc(text)}</div>` + loader('Értékelés…');
      const fb = await genJSON(P.speakingEval(u.current, c.level, t.task_hu, text));
      out.innerHTML = `<div class="fb"><b>Átirat:</b> ${esc(text)}</div><hr/>${feedbackHTML(fb)}`;
      st.setSkill(u, 'beszed', +fb.score || 0);
      st.addWeaknesses(u, fb.weaknesses);
      st.addXP(u, 20, (+fb.score || 0) >= 70 ? 5 : 2);
      st.logActivity(u, 'beszéd', t.task_hu.slice(0, 60), +fb.score || 0);
      hint.textContent = 'Újra is próbálhatod.';
    } catch (e) { out.innerHTML = `<p class="muted">Hiba: ${esc(e.message)}</p>`; }
  };
}
