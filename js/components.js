// Újrahasznosítható elemek: árnyékolás (kiejtés), írás-visszajelzés
import { S, $, esc, I, speakBtn, loader } from './ui.js';
import { genJSON, Recorder } from './api.js';
import * as P from './prompts.js';
import * as st from './store.js';

export function feedbackHTML(fb) {
  return `<div class="stack">
    <div class="row" style="gap:20px"><div class="score grad">${fb.score ?? '–'}</div>
      <div style="flex:1;min-width:200px">${fb.cefr ? `<span class="badge">Becsült szint: ${esc(fb.cefr)}</span>` : ''}
      <p style="margin:8px 0 0">${esc(fb.strengths_hu || fb.feedback_hu || '')}</p></div></div>
    ${fb.errors?.length ? `<div><h3>Javítások</h3>${fb.errors.map((e) => `<div class="err"><s>${esc(e.orig)}</s> → <ins>${esc(e.fix)}</ins>
      ${e.type ? `<span class="pill">${esc(e.type)}</span>` : ''}<div class="dim">${esc(e.explain_hu)}</div></div>`).join('')}</div>` : '<p class="muted">Nincs javítandó hiba – szép munka!</p>'}
    ${fb.corrected ? `<details open><summary>Javított szöveg</summary><p>${esc(fb.corrected)} ${speakBtn(fb.corrected)}</p></details>` : ''}
    ${fb.better ? `<details open><summary>Természetesebb változat</summary><p>${esc(fb.better)} ${speakBtn(fb.better)}</p></details>` : ''}
    ${fb.upgrade ? `<details><summary>Egy szinttel feljebb így hangzana</summary><p>${esc(fb.upgrade)}</p></details>` : ''}
    ${fb.tip_hu ? `<div class="fb good"><b>Következő lépés:</b> ${esc(fb.tip_hu)}</div>` : ''}
    ${fb.__model ? `<div class="dim">Értékelte: ${esc(fb.__model)}</div>` : ''}
  </div>`;
}

// Árnyékolás: meghallgat → felvesz → Gemini értékel. onDone(score)
export function shadow(container, item, onDone) {
  const u = S.u, c = st.course(u);
  container.innerHTML = `
    <div class="stack center">
      <div class="q" style="margin:0">${esc(item.sentence)}</div>
      <div class="muted">${esc(item.hu || '')}</div>
      ${item.focus_hu ? `<div class="dim">🎯 ${esc(item.focus_hu)}</div>` : ''}
      <div class="row" style="justify-content:center">${speakBtn(item.sentence)} <button class="btn icon sm" data-say="${esc(item.sentence)}" data-slow title="Lassan">${I.slow}</button></div>
      <div class="row" style="justify-content:center;margin-top:8px"><button class="mic" data-rec title="Felvétel">${I.mic}</button></div>
      <div class="dim" data-hint>Hallgasd meg, majd nyomd meg a mikrofont, és mondd utána. Még egy nyomás: kész.</div>
      <div data-out></div>
    </div>`;
  const btn = $('[data-rec]', container), out = $('[data-out]', container), hint = $('[data-hint]', container);
  let rec = null;
  btn.onclick = async () => {
    if (!rec) {
      rec = new Recorder();
      try {
        await rec.start((lvl) => btn.style.setProperty('--lvl', Math.min(1, lvl * 3)));
      } catch (e) { rec = null; hint.textContent = 'Nincs mikrofon-hozzáférés: ' + e.message; return; }
      btn.classList.add('rec'); btn.innerHTML = I.stop; hint.textContent = 'Felvétel… beszélj most.';
      const mine = rec;
      setTimeout(() => rec === mine && btn.click(), 15000);
      return;
    }
    const r = rec; rec = null;
    btn.classList.remove('rec'); btn.innerHTML = I.mic; btn.style.setProperty('--lvl', 0);
    const wav = await r.stop();
    if (r.seconds < 0.5) { hint.textContent = 'Túl rövid volt, próbáld újra.'; return; }
    out.innerHTML = loader('Kiejtés elemzése…');
    try {
      const fb = await genJSON(P.pronunciation(u.current, c.level, item.sentence, wav));
      const words = fb.words || [];
      out.innerHTML = `<div class="card" style="margin-top:12px;text-align:left"><div class="row" style="gap:18px">
        <div class="score grad">${fb.score ?? '–'}</div><div style="flex:1">
        <div class="wordscore">${words.map((w) => `<span class="${w.ok ? 'ok' : 'no'}" title="${esc(w.tip_hu || '')}">${esc(w.w)}</span>`).join('')}</div>
        <p class="dim" style="margin:8px 0 0">Hallottam: „${esc(fb.transcript || '')}”</p></div></div>
        <p>${esc(fb.feedback_hu || '')}</p>
        ${words.filter((w) => !w.ok && w.tip_hu).map((w) => `<div class="err"><b>${esc(w.w)}</b>: ${esc(w.tip_hu)}</div>`).join('')}</div>`;
      st.setSkill(u, 'hallas', +fb.score || 0);
      if (fb.weakness) st.addWeaknesses(u, [fb.weakness]);
      hint.textContent = 'Újra is próbálhatod.';
      onDone?.(+fb.score || 0);
    } catch (e) { out.innerHTML = `<p class="muted">Hiba: ${esc(e.message)}</p>`; }
  };
}
