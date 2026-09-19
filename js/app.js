// KokoAI – belépés, nyelvválasztás, szintfelmérés, főoldal, haladás
import { S, nav, go, setTop, view, on, $, $$, esc, loader, errorBox, toast, modal, back, I, shuffle } from './ui.js';
import * as st from './store.js';
import { LANGS, lang, LEVELS, LEVEL_DESC, GOALS, VOICES, METHODS } from './data.js';
import { genJSON, speak, setCodeHandler } from './api.js';
import * as P from './prompts.js';
import { startDaily, daily } from './daily.js';
import './lesson.js';
import './practice.js';
import './conversation.js';

window.__go = go;

// Hozzáférési kód bekérése, ha a szerveren be van állítva
setCodeHandler(() => new Promise((resolve) => {
  const m = modal(`<h3>Hozzáférési kód</h3><p class="muted">Ez a KokoAI példány kóddal védett.</p>
    <input class="input" id="code" type="password" autocomplete="off" placeholder="Kód" />
    <div class="row end"><button class="btn ghost" id="no">Mégse</button><button class="btn primary" id="ok">Mehet</button></div>`);
  const done = (v) => { m.close(); resolve(v); };
  $('#ok', m.el).onclick = () => done($('#code', m.el).value.trim());
  $('#no', m.el).onclick = () => done(null);
  $('#code', m.el).onkeydown = (e) => e.key === 'Enter' && done(e.target.value.trim());
  $('#code', m.el).focus();
}));

// Felolvasás gombok (bárhol az oldalon)
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-say]');
  if (!b || !S.u) return;
  const L = lang(S.u.current);
  b.classList.add('ok');
  speak(b.dataset.say, { voice: S.u.voice, bcp: L.bcp, slow: b.hasAttribute('data-slow') })
    .finally(() => b.classList.remove('ok'));
});

// ---------------- Fejléc ----------------
setTop(() => {
  const top = document.getElementById('top');
  const u = S.u;
  if (!u || !u.current) { top.innerHTML = ''; return; }
  const c = st.course(u);
  const L = lang(u.current);
  top.innerHTML = `
    <button class="brand" onclick="window.__go('home')"><img src="icons/icon.svg" alt=""/><span>Koko<b>AI</b></span></button>
    <span class="sp"></span>
    <button class="chip" onclick="window.__go('langs')" title="Nyelv váltása"><span class="dot"></span>${L.name}${c.level ? ' · ' + c.level : ''}</button>
    <span class="chip fire hide-sm" title="Napi sorozat">🔥 ${u.streak.count}</span>
    <span class="chip hide-sm" title="Mai XP">${u.daily.date === st.today() ? u.daily.xp : 0} XP</span>
    <button class="avatar" title="${esc(u.name)} – haladás és beállítások" onclick="window.__go('progress')">${esc(u.name[0].toUpperCase())}</button>`;
});

// ---------------- Belépés ----------------
nav.welcome = () => {
  const list = st.users();
  const root = view(`
    <section class="hero">
      <img src="icons/icon.svg" alt="" width="84" height="84" style="filter:drop-shadow(0 0 30px rgba(34,232,255,.5))"/>
      <div class="eyebrow" style="margin-top:18px">Gemini-alapú intenzív nyelvtanulás</div>
      <h1>Tanulj nyelvet <span class="grad">mesterséges intelligenciával</span></h1>
      <p>Szintfelmérés, személyre szabott leckék, írás- és kiejtésjavítás, élő beszélgetés anyanyelvi tempóban.</p>
    </section>
    <div class="card glow-border" style="max-width:460px;margin:0 auto">
      <form id="f" class="stack">
        <label class="lbl" for="name">Hogy szólíthatlak?</label>
        <input class="input big" id="name" maxlength="30" autocomplete="nickname" placeholder="Felhasználónév" required />
        <button class="btn primary lg" style="width:100%">Kezdjük ${I.right}</button>
      </form>
      ${list.length ? `<hr/><div class="dim center" style="margin-bottom:10px">Korábbi felhasználók ezen az eszközön</div>
        <div class="users">${list.map((x) => `<button class="chip" data-u="${esc(x.name)}">${esc(x.name)}</button>`).join('')}</div>` : ''}
    </div>
    <div class="gridc" style="margin-top:40px">
      ${[[I.target, 'Adaptív szintfelmérő', 'Pár perc alatt kiderül, hol tartasz (A1–C2).'],
        [I.book, 'Érthető bemenet', 'Épp a szinted fölötti leckék, hanganyaggal.'],
        [I.cards, 'Térközös ismétlés', 'A szavak épp a felejtés előtt jönnek elő.'],
        [I.chat, 'Élő beszélgetés', 'Valós idejű hangbeszélgetés Gemini Live-val.']]
        .map(([i, t, d]) => `<div class="card tile" style="cursor:default"><div class="ico">${i}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}
    </div>`);
  const f = $('#f', root);
  f.onsubmit = (e) => { e.preventDefault(); const n = $('#name', root).value.trim(); if (n) enter(n); };
  on(root, '[data-u]', 'click', (e, b) => enter(b.dataset.u));
  $('#name', root).focus();
};
function enter(name) {
  S.u = st.login(name);
  if (!S.u.current) return go('langs', true);
  const c = st.course(S.u);
  go(c.level ? 'home' : 'placementIntro');
}

// ---------------- Nyelv + cél ----------------
nav.langs = (first = false) => {
  const u = S.u;
  let pick = u.current;
  const root = view(`
    ${first ? '' : back()}
    <h2>${first ? `Szia, <span class="grad">${esc(u.name)}</span>! ` : ''}Melyik nyelvet tanulod?</h2>
    <p class="muted">Több nyelvet is tanulhatsz; mindegyiknek külön szintje és haladása van.</p>
    <div class="langs" style="margin:20px 0">
      ${LANGS.map((l) => { const c = u.langs[l.code];
        return `<button class="lang ${l.code === pick ? 'on' : ''}" data-l="${l.code}"><div class="row between"><span class="tag">${l.tag}</span>${c?.level ? `<span class="badge">${c.level}</span>` : ''}</div>
        <div class="nm">${l.name}</div><div class="nt">${l.native}</div></button>`; }).join('')}
    </div>
    <div class="grid2">
      <div class="card"><label class="lbl">Mi a célod?</label><div class="seg" id="goal">
        ${GOALS.map((g) => `<button data-g="${g.id}" class="${u.goal === g.id ? 'on' : ''}" title="${g.hint}">${g.label}</button>`).join('')}</div></div>
      <div class="card"><label class="lbl">Napi cél</label><div class="seg" id="mins">
        ${[10, 20, 30, 45].map((m) => `<button data-m="${m}" class="${u.dailyMin === m ? 'on' : ''}">${m} perc</button>`).join('')}</div></div>
    </div>
    <div class="row end" style="margin-top:20px"><button class="btn primary lg" id="go" ${pick ? '' : 'disabled'}>Tovább ${I.right}</button></div>`);
  on(root, '[data-l]', 'click', (e, b) => { pick = b.dataset.l; $$('[data-l]', root).forEach((x) => x.classList.toggle('on', x === b)); $('#go', root).disabled = false; });
  on(root, '[data-g]', 'click', (e, b) => { u.goal = b.dataset.g; $$('[data-g]', root).forEach((x) => x.classList.toggle('on', x === b)); st.save(); });
  on(root, '[data-m]', 'click', (e, b) => { u.dailyMin = +b.dataset.m; $$('[data-m]', root).forEach((x) => x.classList.toggle('on', x === b)); st.save(); });
  $('#go', root).onclick = () => {
    u.current = pick; st.save();
    go(st.course(u).level ? 'home' : 'placementIntro');
  };
};

// ---------------- Szintfelmérés ----------------
nav.placementIntro = () => {
  const L = lang(S.u.current);
  const root = view(`
    <div class="hero" style="padding-top:3vh"><div class="eyebrow">${L.name} · szintfelmérés</div>
      <h2>Nézzük meg, <span class="grad">hol tartasz</span></h2>
      <p>10 adaptív kérdés (jó válasz után nehezebb, rossz után könnyebb), majd egy rövid, kihagyható írásminta. Kb. 4–6 perc.</p></div>
    <div class="grid2" style="max-width:760px;margin:0 auto">
      <button class="card tile glow-border" id="test"><div class="ico">${I.target}</div><h3>Gyors szintfelmérő</h3><p>A Gemini állítja össze és értékeli.</p></button>
      <button class="card tile" id="zero"><div class="ico">${I.spark}</div><h3>Teljesen kezdő vagyok</h3><p>Kezdés A1-ről, felmérés nélkül.</p></button>
    </div>`);
  $('#test', root).onclick = () => go('placement');
  $('#zero', root).onclick = () => {
    const c = st.course(S.u);
    c.level = 'A1'; c.progress = 0; c.placement = { date: Date.now(), level: 'A1', summary_hu: 'Kezdő szint, felmérés nélkül.' };
    st.save(); go('home');
  };
};

nav.placement = (mode = 'full') => runTest(mode);

async function runTest(mode) {
  const u = S.u, c = st.course(u), L = lang(u.current);
  const isLevelUp = mode === 'levelup';
  view(loader(isLevelUp ? 'Szintlépő teszt összeállítása…' : 'A szintfelmérő összeállítása…'));
  let pool;
  try {
    const j = await genJSON(isLevelUp ? P.levelUpPool(u.current, c.level) : P.placementPool(u.current));
    pool = (j.items || []).filter((x) => x.options?.length >= 2 && Number.isInteger(x.answer));
    if (pool.length < 6) throw new Error('Túl kevés feladat jött vissza.');
  } catch (e) { return view(errorBox(e, () => runTest(mode))); }

  const levels = isLevelUp ? [c.level, st.nextLevel(c.level)] : ['A1', 'A2', 'B1', 'B2', 'C1'];
  const total = isLevelUp ? 8 : 10;
  let li = isLevelUp ? 1 : 2; // B1-ről indul
  const answers = [];
  const used = new Set();

  const pickItem = () => {
    for (let d = 0; d < levels.length; d++) {
      for (const k of [li - d, li + d]) {
        const lv = levels[k];
        if (!lv) continue;
        const it = shuffle(pool).find((x) => x.level === lv && !used.has(x));
        if (it) { used.add(it); return it; }
      }
    }
    return null;
  };

  const ask = () => {
    const it = answers.length < total ? pickItem() : null;
    if (!it) return writingStep();
    const n = answers.length;
    const root = view(`
      <div class="card glow-border" style="max-width:720px;margin:0 auto">
        <div class="row between"><span class="eyebrow">${isLevelUp ? 'Szintlépő teszt' : 'Szintfelmérő'} · ${n + 1}/${total}</span><span class="dim">${esc(it.skill || '')}</span></div>
        <div class="progress" style="margin:12px 0 4px"><i style="width:${(n / total) * 100}%"></i></div>
        <div class="q">${esc(it.q)}</div>
        <div class="opts">${it.options.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>
        <div class="row end" style="margin-top:14px"><button class="btn ghost sm" id="idk">Nem tudom</button></div>
      </div>`);
    const answer = (i) => {
      const ok = i === it.answer;
      answers.push({ level: it.level, skill: it.skill, ok });
      $$('.opt', root).forEach((b, j) => { b.disabled = true; if (j === it.answer) b.classList.add('right'); else if (j === i) b.classList.add('wrong'); });
      li = Math.max(0, Math.min(levels.length - 1, li + (ok ? 1 : -1)));
      setTimeout(ask, ok ? 550 : 1100);
    };
    on(root, '.opt', 'click', (e, b) => answer(+b.dataset.i));
    $('#idk', root).onclick = () => answer(-1);
  };

  const writingStep = () => {
    if (isLevelUp) return finish('');
    const root = view(`
      <div class="card glow-border stack" style="max-width:720px;margin:0 auto">
        <span class="eyebrow">Utolsó lépés · írásminta</span>
        <h3>Írj 3–6 mondatot ${L.name} nyelven magadról: ki vagy, mivel foglalkozol, miért tanulod a nyelvet.</h3>
        <textarea id="w" placeholder="Írj, ahogy tudsz – a hibák is sokat elárulnak."></textarea>
        <div class="row end"><button class="btn ghost" id="skip">Kihagyom</button><button class="btn primary" id="ok">Kiértékelés ${I.right}</button></div>
      </div>`);
    $('#skip', root).onclick = () => finish('');
    $('#ok', root).onclick = () => finish($('#w', root).value.trim());
  };

  const finish = async (writing) => {
    const correct = answers.filter((a) => a.ok).length;
    if (isLevelUp) {
      const hi = answers.filter((a) => a.level === levels[1]);
      const hiOk = hi.filter((a) => a.ok).length;
      const passed = hi.length ? hiOk / hi.length >= 0.6 && correct / answers.length >= 0.65 : correct / answers.length >= 0.75;
      if (passed) { c.level = levels[1]; c.progress = 0; st.addXP(u, 60); st.logActivity(u, 'szint', `Szintlépés: ${c.level}`, 100); }
      else { c.progress = 70; st.save(); st.logActivity(u, 'szint', `Szintlépő teszt (${levels[1]})`, Math.round((correct / answers.length) * 100)); }
      const root = view(`<div class="card glow-border center stack" style="max-width:560px;margin:4vh auto">
        <div class="ring" style="--p:${Math.round((correct / answers.length) * 100)};margin:0 auto"><span>${passed ? c.level : levels[0]}</span></div>
        <h2>${passed ? 'Gratulálok, szintet léptél!' : 'Még egy kis gyakorlás'}</h2>
        <p class="muted">${correct}/${answers.length} helyes. ${passed ? `Mostantól ${c.level} szintű leckéket kapsz.` : 'A következő leckék a hiányzó elemekre fókuszálnak; hamarosan újra próbálhatod.'}</p>
        <button class="btn primary" id="h">Tovább</button></div>`);
      $('#h', root).onclick = () => go('home');
      return;
    }
    view(loader('A Gemini kiértékeli az eredményed…'));
    let r;
    try { r = await genJSON(P.placementEval(u.current, answers, writing)); }
    catch {
      // helyi becslés, ha a kiértékelés nem sikerül
      const best = [...LEVELS].reverse().find((lv) => { const a = answers.filter((x) => x.level === lv); return a.length && a.filter((x) => x.ok).length / a.length >= 0.5; }) || 'A1';
      r = { level: best, skills: {}, summary_hu: 'Helyi becslés a tesztválaszok alapján.', focus: [] };
    }
    if (!LEVELS.includes(r.level)) r.level = 'A2';
    c.level = r.level; c.progress = 0;
    c.placement = { date: Date.now(), ...r };
    for (const [k, v] of Object.entries(r.skills || {})) if (k in c.skills) c.skills[k] = +v || 0;
    st.addWeaknesses(u, r.focus);
    st.addXP(u, 30);
    st.logActivity(u, 'felmérés', `Szintfelmérő: ${r.level}`, Math.round((correct / answers.length) * 100));
    const root = view(`
      <div class="card glow-border stack" style="max-width:720px;margin:2vh auto">
        <div class="row" style="gap:24px">
          <div class="ring" style="--p:${(LEVELS.indexOf(r.level) + 1) / 6 * 100}"><div><span>${r.level}</span><small>CEFR</small></div></div>
          <div style="flex:1;min-width:220px"><span class="eyebrow">Az eredményed</span><h2>${esc(LEVEL_DESC[r.level])}</h2>
          <p class="muted">${esc(r.summary_hu || '')}</p></div>
        </div>
        ${skillBars(c.skills)}
        ${r.focus?.length ? `<div><b>Erre fókuszálunk:</b><ul>${r.focus.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
        <div class="row end"><button class="btn primary lg" id="h">Irány a tanulás ${I.right}</button></div>
      </div>`);
    $('#h', root).onclick = () => go('home');
  };
  ask();
}

export function skillBars(sk) {
  const names = { szokincs: 'Szókincs', nyelvtan: 'Nyelvtan', olvasas: 'Olvasás', iras: 'Írás', beszed: 'Beszéd', hallas: 'Kiejtés' };
  return `<div class="bars">${Object.entries(names).map(([k, n]) =>
    `<div class="b"><span class="muted">${n}</span><div class="progress"><i style="width:${sk[k] || 0}%"></i></div><b>${sk[k] || '–'}</b></div>`).join('')}</div>`;
}

// ---------------- Főoldal ----------------
nav.home = () => {
  daily.i = -1;
  const u = S.u, c = st.course(u), L = lang(u.current);
  const cs = st.cardStats(u);
  const xpToday = u.daily.date === st.today() ? u.daily.xp : 0;
  const goalXp = u.dailyMin * 5;
  const h = new Date().getHours();
  const hello = h < 10 ? 'Jó reggelt' : h < 18 ? 'Szia' : 'Jó estét';
  const tiles = [
    ['lesson', I.book, 'Új lecke', 'Érthető bemenet, nyelvtan, gyakorlás – személyre szabva', ''],
    ['cards', I.cards, 'Szókártyák', 'Térközös ismétlés gépeléssel és hanggal', cs.due ? `<span class="badge pink">${cs.due} esedékes</span>` : ''],
    ['writing', I.pen, 'Írás', 'Valós feladat, részletes javítás, magasabb szintű minta', ''],
    ['speaking', I.wave, 'Kiejtés és beszéd', 'Árnyékolás szavankénti értékeléssel, szabad beszéd', ''],
    ['live', I.chat, 'Élő beszélgetés', 'Szerepjáték valós időben – Gemini Live', '<span class="badge">LIVE</span>'],
    ['translate', I.globe, 'Élő tolmács', 'Mondd magyarul, halld célnyelven – Live Translate', '<span class="badge">LIVE</span>'],
  ];
  const root = view(`
    <div class="row between" style="margin-bottom:20px;align-items:flex-end">
      <div><div class="eyebrow">${L.name} · ${L.native}</div><h1 style="margin-top:6px">${hello}, <span class="grad">${esc(u.name)}</span>!</h1></div>
    </div>
    <div class="grid2">
      <div class="card glow-border feature big">
        <div class="ring" style="--p:${c.progress}"><div><span>${c.level}</span><small>${c.progress}% → ${st.nextLevel(c.level)}</small></div></div>
        <div class="txt stack">
          <div><span class="eyebrow">Napi intenzív kör</span><h2>Ismétlés → új lecke → kiejtés → írás → élő beszélgetés</h2>
          <p class="muted" style="margin:0">Összekevert gyakorlás a leghatékonyabb bevésésért. Mai cél: ${goalXp} XP.</p></div>
          <div class="progress"><i style="width:${Math.min(100, (xpToday / goalXp) * 100)}%"></i></div>
          <div class="row"><button class="btn primary lg" id="daily">${I.bolt} Indítás</button>
          ${c.progress >= 100 ? `<button class="btn lg" id="lvl">${I.target} Szintlépő teszt</button>` : ''}</div>
        </div>
      </div>
    </div>
    <div class="grid3" style="margin-top:16px">
      ${tiles.map(([id, ic, t, d, b]) => `<button class="card tile" data-go="${id}">${b ? `<span class="badge-wrap" style="position:absolute;top:16px;right:16px">${b}</span>` : ''}<div class="ico">${ic}</div><h3>${t}</h3><p>${d}</p></button>`).join('')}
    </div>
    <div class="gridc" style="margin-top:16px">
      <div class="card stat"><div class="n">${c.xp}</div><div class="l">összes XP</div></div>
      <div class="card stat"><div class="n">${cs.total}</div><div class="l">kifejezés a gyűjteményben · ${cs.learned} bevésve</div></div>
      <div class="card stat"><div class="n">🔥 ${u.streak.count}</div><div class="l">napos sorozat</div></div>
      <button class="card stat tile" data-go="methods"><div class="n" style="font-size:18px">${I.info} Módszertan</div><div class="l">Milyen kutatásokra épül a KokoAI?</div></button>
    </div>
    ${c.weaknesses.length ? `<div class="card" style="margin-top:16px"><h3>Gyenge pontjaid</h3><div class="row" style="gap:8px">${c.weaknesses.slice(0, 8).map((w) => `<span class="pill">${esc(w.k)}</span>`).join('')}</div>
      <p class="dim" style="margin:10px 0 0">A következő leckék ezekre fókuszálnak.</p></div>` : ''}`);
  on(root, '[data-go]', 'click', (e, b) => go(b.dataset.go));
  $('#daily', root).onclick = () => startDaily();
  $('#lvl', root)?.addEventListener('click', () => go('placement', 'levelup'));
};

// ---------------- Haladás + beállítások ----------------
nav.progress = () => {
  const u = S.u, c = st.course(u), L = lang(u.current);
  const root = view(`
    ${back()}
    <h2>${esc(u.name)} <span class="muted" style="font-size:.6em">· ${L.name}</span></h2>
    <div class="grid2" style="margin-top:16px">
      <div class="card stack"><div class="row" style="gap:20px"><div class="ring" style="--p:${c.progress}"><div><span>${c.level}</span><small>${c.progress}%</small></div></div>
        <div><b>${esc(LEVEL_DESC[c.level])}</b><p class="dim">Szintlépés: 100%-nál szintlépő teszt nyílik.</p></div></div>
        ${skillBars(c.skills)}</div>
      <div class="card"><h3>Legutóbbi tevékenységek</h3><div class="list">${c.history.slice(0, 12).map((h) =>
        `<div class="it"><span>${esc(h.title)}</span><span class="dim">${h.score != null ? h.score + '% · ' : ''}${new Date(h.t).toLocaleDateString('hu-HU')}</span></div>`).join('') || '<p class="dim">Még nincs.</p>'}</div></div>
    </div>
    <div class="grid2" style="margin-top:16px">
      <div class="card stack"><h3>Beállítások</h3>
        <div><label class="lbl">Tanár hangja (felolvasás és élő beszélgetés)</label><select id="voice">${VOICES.map((v) => `<option value="${v.id}" ${u.voice === v.id ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
        <div><label class="lbl">Cél</label><select id="goal">${GOALS.map((g) => `<option value="${g.id}" ${u.goal === g.id ? 'selected' : ''}>${g.label} – ${g.hint}</option>`).join('')}</select></div>
        <div><label class="lbl">Szint kézi beállítása</label><select id="lvl">${LEVELS.map((l) => `<option ${c.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="row"><button class="btn sm" id="try">${I.play} Hang kipróbálása</button><button class="btn sm" id="retest">${I.target} Új szintfelmérés</button></div>
      </div>
      <div class="card stack"><h3>Fiók</h3>
        <p class="muted">Az adatok ezen az eszközön, a böngészőben tárolódnak, felhasználónevenként.</p>
        <div class="row"><button class="btn" id="langs">${I.globe} Nyelv váltása</button><button class="btn" id="out">Kijelentkezés</button></div>
        <div class="row"><button class="btn sm ghost" id="export">Mentés fájlba</button><label class="btn sm ghost">Visszatöltés<input type="file" id="imp" accept="application/json" hidden></label>
        <button class="btn sm bad ghost" id="del">Profil törlése</button></div>
      </div>
    </div>`);
  $('#voice', root).onchange = (e) => { u.voice = e.target.value; st.save(); };
  $('#goal', root).onchange = (e) => { u.goal = e.target.value; st.save(); };
  $('#lvl', root).onchange = (e) => { c.level = e.target.value; c.progress = 0; st.save(); toast('Szint beállítva: ' + c.level); };
  $('#try', root).onclick = () => speak({ en: 'Hello! I am your KokoAI tutor.', de: 'Hallo! Ich bin deine KokoAI-Lehrerin.', es: '¡Hola! Soy tu profesora de KokoAI.', fr: 'Bonjour ! Je suis ta professeure KokoAI.', it: 'Ciao! Sono la tua insegnante KokoAI.' }[u.current] || 'Hello! I am your KokoAI tutor.', { voice: u.voice, bcp: L.bcp });
  $('#retest', root).onclick = () => go('placement');
  $('#langs', root).onclick = () => go('langs');
  $('#out', root).onclick = () => { st.logout(); S.u = null; go('welcome'); };
  $('#del', root).onclick = () => { if (confirm(`Biztosan törlöd ${u.name} profilját minden nyelvvel?`)) { st.removeUser(u.name); st.logout(); S.u = null; go('welcome'); } };
  $('#export', root).onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(u, null, 2)], { type: 'application/json' }));
    a.download = `kokoai-${u.name}.json`; a.click();
  };
  $('#imp', root).onchange = async (e) => {
    try {
      const d = JSON.parse(await e.target.files[0].text());
      if (!d.name || !d.langs) throw new Error('nem KokoAI mentés');
      Object.assign(u, d); st.save(); toast('Visszatöltve'); go('home');
    } catch (err) { toast('Hiba: ' + err.message); }
  };
};

nav.methods = () => {
  view(`${back()}<h2>Módszertan</h2><p class="muted">A KokoAI a nyelvelsajátítás-kutatás legerősebb bizonyítékkal bíró eljárásaira épül.</p>
    <div class="grid2" style="margin-top:16px">${METHODS.map(([t, d]) => `<div class="card"><h3>${t}</h3><p class="muted" style="margin:0">${d}</p></div>`).join('')}</div>
    <div class="card" style="margin-top:16px"><h3>Felhasznált Gemini modellek</h3><p class="muted" style="margin:0">
    Leckék és értékelés: Gemini 3.x Flash (3.8 → 3.5, kvótánként továbblépve) · gyors ellenőrzés, átirat: 3.5 Flash-Lite · felolvasás: Gemini 3.1 Flash TTS (napi keret után a böngésző hangja) ·
    kiejtés: multimodális hangelemzés · beszélgetés: Gemini Live · tolmács: 3.5 Live Translate.</p></div>`);
};

// ---------------- Indítás ----------------
S.u = st.lastUser();
if (!S.u) go('welcome');
else if (!S.u.current) go('langs', true);
else go(st.course(S.u).level ? 'home' : 'placementIntro');
