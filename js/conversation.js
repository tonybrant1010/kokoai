// Élő beszélgetés (Gemini Live) és élő tolmács (Live Translate)
import { S, nav, go, view, on, onLeave, $, esc, loader, toast, back, I } from './ui.js';
import * as st from './store.js';
import { lang, SCENARIOS, LEVELS, LANGS } from './data.js';
import { genJSON } from './api.js';
import { LiveSession } from './live.js';
import * as P from './prompts.js';
import { feedbackHTML } from './components.js';
import { dailyBar, dailyNext, dailyActive } from './daily.js';

const STATE = { kapcsolodik: 'Kapcsolódás…', hallgat: 'Hallgatlak – beszélj nyugodtan', beszel: 'KokoAI beszél…', ki: 'Szünetel', hiba: 'Hiba történt' };

// ---------------- Élő beszélgetés ----------------
nav.live = () => {
  const u = S.u, c = st.course(u), L = lang(u.current);
  const lv = LEVELS.indexOf(c.level);
  const root = view(`${dailyBar()}${back()}<span class="eyebrow">Élő beszélgetés · Gemini Live</span>
    <h2 style="margin-top:6px">Válassz helyzetet</h2>
    <p class="muted">Valós idejű hangbeszélgetés ${L.name} nyelven. A tanár átfogalmazással javít, és a végén összegzést kapsz a hibáidról.</p>
    <div class="gridc" style="margin-top:16px">${SCENARIOS.map((s) => {
      const locked = LEVELS.indexOf(s.min) > lv + 1;
      return `<button class="card tile" data-s="${s.id}" ${locked ? 'disabled style="opacity:.45"' : ''}><span class="badge" style="position:absolute;top:16px;right:16px">${s.min}+</span>
        <div class="ico">${I.chat}</div><h3>${s.title}</h3><p>${s.desc}</p></button>`; }).join('')}</div>
    ${dailyActive() ? `<div class="row end" style="margin-top:16px"><button class="btn ghost" id="skip">Kihagyom, befejezem a kört</button></div>` : ''}`);
  on(root, '[data-s]', 'click', (e, b) => session(SCENARIOS.find((s) => s.id === b.dataset.s)));
  $('#skip', root)?.addEventListener('click', dailyNext);
};

function session(sc) {
  const u = S.u, c = st.course(u), L = lang(u.current);
  const lines = []; // {who:'T'|'K', text}
  let cur = null;
  const root = view(`${dailyBar()}<button class="back" id="bk">${I.left} Helyzetek</button>
    <div class="grid2">
      <div class="card glow-border center stack">
        <span class="eyebrow">${esc(sc.title)} · ${L.name} · ${c.level}</span>
        <div class="orb idle" id="orb"></div>
        <div id="st" class="muted">Nyomd meg az indítást. Fejhallgató ajánlott.</div>
        <div class="row" style="justify-content:center">
          <button class="btn primary lg" id="start">${I.mic} Indítás</button>
          <button class="btn lg" id="stop" hidden>${I.stop} Befejezés</button>
        </div>
        <div class="row" style="justify-content:center;gap:8px" id="helpers" hidden>
          <button class="btn sm" data-h="Kérlek, ismételd meg lassabban.">Lassabban</button>
          <button class="btn sm" data-h="(A tanuló elakadt. Adj neki magyarul egy rövid segítséget: hogyan mondhatná el, amit akar, majd folytasd a célnyelven.)">Segítség magyarul</button>
          <button class="btn sm" data-h="(Adj egy új, érdekes kérdést, hogy a beszélgetés folytatódjon.)">Új kérdés</button>
        </div>
        <div class="dim" id="diag"></div>
      </div>
      <div class="card"><h3>Átirat</h3><div class="transcript" id="tr"><p class="dim">Itt jelenik meg a beszélgetés szövege.</p></div></div>
    </div>
    <div id="rev"></div>`);
  const orb = $('#orb', root), stEl = $('#st', root), tr = $('#tr', root);
  const push = (who, text) => {
    if (!cur || cur.who !== who) { cur = { who, text: '' }; lines.push(cur); if (lines.length === 1) tr.innerHTML = ''; cur.el = document.createElement('div'); cur.el.className = 'msg ' + (who === 'T' ? 't' : 'k'); tr.appendChild(cur.el); }
    cur.text += text; cur.el.textContent = cur.text; tr.scrollTop = tr.scrollHeight;
  };
  const live = new LiveSession({
    onState: (s) => { stEl.textContent = STATE[s] || s; orb.classList.toggle('idle', s === 'ki' || s === 'hiba' || s === 'kapcsolodik'); },
    onUser: (t) => { push('T', t); orb.classList.add('user'); },
    onModel: (t) => { push('K', t); orb.classList.remove('user'); },
    onTurnEnd: () => { cur = null; },
    onLevel: (l) => orb.style.setProperty('--lvl', l),
    onDiag: (d) => { $('#diag', root).textContent = d; },
  });
  onLeave(() => live.stop());
  let t0 = 0;
  $('#bk', root).onclick = () => { live.stop(); nav.live(); };
  $('#start', root).onclick = async () => {
    $('#start', root).hidden = true; $('#stop', root).hidden = false; $('#helpers', root).hidden = false;
    t0 = Date.now();
    try {
      await live.start({
        mode: 'tutor', voice: u.voice,
        systemInstruction: P.tutorSystem(u, c, sc),
        kickoff: `(Kezdd el a beszélgetést ${L.name} nyelven: köszönj ${u.name}-nak röviden, és indítsd el a helyzetet egy kérdéssel.)`,
      });
    } catch (e) {
      stEl.textContent = 'Nem sikerült kapcsolódni: ' + e.message;
      $('#start', root).hidden = false; $('#stop', root).hidden = true;
    }
  };
  on(root, '[data-h]', 'click', (e, b) => live.sendText(b.dataset.h));
  $('#stop', root).onclick = async () => {
    live.stop();
    $('#stop', root).hidden = true; $('#helpers', root).hidden = true;
    const mins = Math.max(1, Math.round((Date.now() - t0) / 60000));
    const text = lines.map((l) => `${l.who}: ${l.text.trim()}`).join('\n');
    const userWords = lines.filter((l) => l.who === 'T').reduce((a, l) => a + (l.text.match(/\S+/g) || []).length, 0);
    st.addXP(u, Math.min(40, 8 * mins), Math.min(8, 2 * mins));
    const rev = $('#rev', root);
    const nextBtn = dailyActive() ? `<div class="row end" style="margin-top:16px"><button class="btn primary" id="nx">Napi kör befejezése ${I.right}</button></div>` : '';
    if (userWords < 5) {
      rev.innerHTML = `<div class="card" style="margin-top:16px"><p class="muted">Rövid volt a beszélgetés, most nem készül összegzés.</p>${nextBtn}</div>`;
    } else {
      rev.innerHTML = `<div class="card" style="margin-top:16px">${loader('Összegzés készül a beszélgetésről…')}</div>`;
      try {
        const fb = await genJSON(P.liveReview(u.current, c.level, text));
        const added = st.addCards(u, fb.vocab, sc.title);
        st.setSkill(u, 'beszed', +fb.score || 0);
        st.addWeaknesses(u, fb.weaknesses);
        st.logActivity(u, 'élő', sc.title, +fb.score || 0);
        rev.innerHTML = `<div class="card glow-border" style="margin-top:16px"><h3>Összegzés</h3>${feedbackHTML(fb)}
          ${added ? `<p class="dim">${added} hasznos kifejezés került a szókártyáid közé.</p>` : ''}${nextBtn}</div>`;
      } catch (e) { rev.innerHTML = `<div class="card" style="margin-top:16px"><p class="muted">Az összegzés nem sikerült: ${esc(e.message)}</p>${nextBtn}</div>`; }
    }
    $('#nx', root)?.addEventListener('click', dailyNext);
    $('#start', root).hidden = false; $('#start', root).innerHTML = `${I.mic} Új beszélgetés`;
  };
}

// ---------------- Élő tolmács ----------------
nav.translate = () => {
  const u = S.u;
  let target = u.current;
  const root = view(`${back()}<span class="eyebrow">Élő tolmács · Gemini Live Translate</span>
    <h2 style="margin-top:6px">Mondd magyarul – halld <span class="grad" id="tn">${lang(target).adv}</span></h2>
    <p class="muted">Tanulási trükk: mondd el magyarul, amit ki szeretnél fejezni, hallgasd meg a fordítást, és mondd utána.</p>
    <div class="grid2" style="margin-top:12px">
      <div class="card glow-border center stack">
        <div><label class="lbl">Célnyelv</label><select id="lg" style="max-width:260px">${LANGS.map((l) => `<option value="${l.code}" ${l.code === target ? 'selected' : ''}>${l.name}</option>`).join('')}</select></div>
        <div class="orb idle" id="orb"></div>
        <div id="st" class="muted">Indítás után beszélj.</div>
        <div class="row" style="justify-content:center"><button class="btn primary lg" id="start">${I.mic} Indítás</button><button class="btn lg" id="stop" hidden>${I.stop} Leállítás</button></div>
        <div class="dim" id="diag"></div>
      </div>
      <div class="card"><div class="row between"><h3>Fordítások</h3><button class="btn sm" id="save" disabled>${I.cards} Mentés szókártyának</button></div>
        <div class="transcript" id="tr"><p class="dim">Itt jelennek meg a mondatpárok.</p></div></div>
    </div>`);
  const orb = $('#orb', root), tr = $('#tr', root);
  const pairs = []; let cur = null;
  const ensure = () => {
    if (!cur) { cur = { src: '', dst: '' }; pairs.push(cur); if (pairs.length === 1) tr.innerHTML = '';
      cur.el = document.createElement('div'); cur.el.className = 'card'; cur.el.style.padding = '12px'; tr.appendChild(cur.el); }
    return cur;
  };
  const draw = (p) => { p.el.innerHTML = `<div class="dim">${esc(p.src)}</div><div style="font-size:17px;margin-top:4px">${esc(p.dst)}</div>`; tr.scrollTop = tr.scrollHeight; };
  const live = new LiveSession({
    onState: (s) => { $('#st', root).textContent = { hallgat: 'Hallgatlak…', beszel: 'Fordítás…' }[s] || STATE[s] || s; orb.classList.toggle('idle', s === 'ki' || s === 'hiba'); },
    onUser: (t) => { const p = ensure(); p.src += t; draw(p); },
    onModel: (t) => { const p = ensure(); p.dst += t; draw(p); $('#save', root).disabled = false; },
    onTurnEnd: () => { cur = null; },
    onLevel: (l) => orb.style.setProperty('--lvl', l),
    onDiag: (d) => { $('#diag', root).textContent = d; },
  });
  onLeave(() => live.stop());
  $('#lg', root).onchange = (e) => { target = e.target.value; $('#tn', root).textContent = lang(target).adv; if (live.active) { live.stop(); $('#start', root).hidden = false; $('#stop', root).hidden = true; } };
  $('#start', root).onclick = async () => {
    $('#start', root).hidden = true; $('#stop', root).hidden = false;
    try { await live.start({ mode: 'translate', targetLanguageCode: lang(target).code }); }
    catch (e) { $('#st', root).textContent = 'Nem sikerült: ' + e.message; $('#start', root).hidden = false; $('#stop', root).hidden = true; }
  };
  $('#stop', root).onclick = () => { live.stop(); $('#start', root).hidden = false; $('#stop', root).hidden = true; };
  $('#save', root).onclick = () => {
    if (target !== u.current) return toast('Csak az aktuálisan tanult nyelvhez menthető.');
    const items = pairs.filter((p) => p.src.trim() && p.dst.trim() && p.dst.length < 120).map((p) => ({ term: p.dst.trim(), hu: p.src.trim() }));
    const n = st.addCards(u, items, 'tolmács');
    toast(`${n} mondat mentve a szókártyák közé.`);
  };
};
