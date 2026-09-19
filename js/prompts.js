// A Gemini-nek szóló utasítások. Felület és magyarázat: magyar; célnyelvi anyag: a tanult nyelv.
import { lang, GOALS, LEVELS } from './data.js';

const goalText = (u) => { const g = GOALS.find((x) => x.id === u.goal) || GOALS[0]; return `${g.label} (${g.hint})`; };

export const SYSTEM = `Tapasztalt, kutatásalapú módszertannal dolgozó nyelvtanár vagy (CEFR, érthető bemenet i+1, lexikai megközelítés, előhívásos gyakorlás, feladatalapú tanulás, javító visszajelzés).
A tanuló anyanyelve magyar. Minden magyarázat, utasítás és visszajelzés magyarul szól, tömören.
A célnyelvi anyag természetes, hiteles, a megadott CEFR-szinthez illő. Csak érvényes JSON-t adj vissza, ha JSON-t kérnek.`;

export function placementPool(code, levels = ['A1', 'A2', 'B1', 'B2', 'C1'], per = 3) {
  const L = lang(code);
  return {
    role: 'text', temperature: 0.8, system: SYSTEM,
    prompt: `Készíts gyors, adaptív szintfelmérő feladatbankot ${L.name} (${L.native}) nyelvből.
Szintek: ${levels.join(', ')}; szintenként ${per} feladat, vegyesen: szókincs, nyelvtan, rövid olvasásértés (1–3 mondatos szöveg + kérdés).
Minden feladat 4 opciós feleletválasztós, pontosan 1 helyes válasszal. A kérdés szövege célnyelvi (A1-nél mehet magyar utasítás), az opciók célnyelviek.
JSON: {"items":[{"level":"A1","skill":"szokincs|nyelvtan|olvasas","q":"…","options":["…","…","…","…"],"answer":0,"hu":"rövid magyar magyarázat"}]}`,
  };
}

export function placementEval(code, answers, writing) {
  const L = lang(code);
  return {
    role: 'text', temperature: 0.2, system: SYSTEM,
    prompt: `Egy tanuló ${L.name} szintfelmérőt töltött ki (adaptív, lépcsőzetes).
Válaszok (szint, készség, helyes-e): ${JSON.stringify(answers)}
${writing ? `Írásminta (célnyelven): """${writing}"""` : 'Írásmintát nem adott.'}
Becsüld meg a CEFR-szintet (A1–C2) és a részkészségeket 0–100 skálán. Legyél realista: ha bizonytalan, a lejjebbi szintet válaszd.
JSON: {"level":"B1","confidence":0.7,"skills":{"szokincs":60,"nyelvtan":50,"olvasas":65,"iras":40},"summary_hu":"2-3 mondat","focus":["3-5 konkrét fejlesztendő terület magyarul"]}`,
  };
}

export function lesson(u, c) {
  const L = lang(u.current);
  const weak = c.weaknesses.slice(0, 5).map((w) => w.k).join('; ') || 'nincs még adat';
  const done = c.topics.slice(-12).join('; ') || 'még nincs';
  const due = c.cards.filter((x) => x.due <= Date.now()).slice(0, 6).map((x) => x.term).join(', ');
  return {
    role: 'text', temperature: 0.9, system: SYSTEM,
    prompt: `Készíts egy intenzív, 15–20 perces ${L.name} leckét.
Szint: ${c.level} (haladás a következő szintig: ${c.progress}%). Cél: ${goalText(u)}.
Gyenge pontok, amelyekre fókuszálj: ${weak}.
Korábbi témák (ne ismételd): ${done}.
${due ? `Ha természetesen belefér, használd újra ezeket a kifejezéseket is: ${due}.` : ''}
Elvek: érthető bemenet i+1 (a szöveg 90–95%-a ismert szintű legyen), gyakori szóláncok, egy fókuszált nyelvtani pont, előhívásos feladatok.
JSON:
{"title":"rövid cím magyarul","topic":"téma pár szóban","goal_hu":"mit fogsz tudni a lecke végén (1 mondat)",
"text":[{"speaker":"A vagy név vagy üres","line":"célnyelvi mondat","hu":"magyar fordítás"}],  // 8–12 sor párbeszéd vagy rövid szöveg
"vocab":[{"term":"célnyelvi kifejezés/szólánc","hu":"jelentés","example":"példamondat","ex_hu":"fordítás"}], // 6–10 db
"grammar":{"title":"nyelvtani pont","explanation_hu":"tömör magyarázat (max 5 mondat)","examples":[{"t":"példa","hu":"fordítás"}]},
"exercises":[ // 7 feladat, vegyesen
 {"type":"mc","q":"kérdés","options":["…"],"answer":0,"explain_hu":"…"},
 {"type":"cloze","q":"mondat ___ hiánnyal","hu":"magyar jelentés","answer":"hiányzó szó","accept":["elfogadható változatok"],"explain_hu":"…"},
 {"type":"order","hu":"magyar mondat","answer":"helyes célnyelvi mondat","explain_hu":"…"},
 {"type":"translate","hu":"lefordítandó magyar mondat","answer":"mintamegoldás","explain_hu":"…"}],
"speaking":[{"sentence":"árnyékolásra szánt célnyelvi mondat","hu":"fordítás"}], // 3 db
"writing":{"prompt_hu":"rövid, valós helyzetű íráskérdés","min_words":${['A1', 'A2'].includes(c.level) ? 25 : c.level === 'B1' ? 60 : 100}}}`,
  };
}

export function judgeTranslate(code, level, hu, model, user) {
  const L = lang(code);
  return {
    role: 'fast', temperature: 0.1, system: SYSTEM,
    prompt: `${L.name} fordítás ellenőrzése (${level} szint). Magyar: "${hu}". Mintamegoldás: "${model}". Tanuló: "${user}".
Fogadd el, ha jelentésben és nyelvtanilag helyes (más szórend/szinonima is jó). Apró helyesírási hiba: correct=true, de jelezd.
JSON: {"correct":true,"better":"javított/természetesebb változat","explain_hu":"1-2 mondat","weakness":"ha hibás: a hiba kategóriája röviden magyarul, különben üres"}`,
  };
}

export function writingTask(u, c) {
  const L = lang(u.current);
  return {
    role: 'fast', temperature: 1, system: SYSTEM,
    prompt: `Adj egy valós helyzetű ${L.name} írásfeladatot ${c.level} szinten. Cél: ${goalText(u)}. Kerüld: ${c.topics.slice(-6).join('; ')}.
JSON: {"prompt_hu":"feladat magyarul (1-2 mondat)","hints":["3 hasznos célnyelvi kifejezés"],"min_words":${['A1', 'A2'].includes(c.level) ? 30 : c.level === 'B1' ? 70 : 120}}`,
  };
}

export function writingFeedback(code, level, task, text, deep = false) {
  const L = lang(code);
  return {
    role: deep ? 'pro' : 'text', temperature: 0.2, system: SYSTEM,
    prompt: `Értékeld a tanuló ${L.name} szövegét (${level} szint). Feladat: "${task}".
Szöveg: """${text}"""
${deep ? 'Mélyelemzés: térj ki a koherenciára, regiszterre, kollokációkra és a következő szinthez szükséges szerkezetekre is.' : ''}
Javító visszajelzés: minden hibánál az eredeti részlet, a javítás, a kategória és rövid magyar magyarázat. Dicsérd a jól sikerült elemeket konkrétan.
JSON: {"score":0-100,"cefr":"a szöveg becsült szintje","corrected":"a teljes javított szöveg","errors":[{"orig":"…","fix":"…","type":"nyelvtan|szókincs|helyesírás|szórend|stílus","explain_hu":"…"}],
"strengths_hu":"…","tip_hu":"egy konkrét következő lépés","upgrade":"a szöveg egy szinttel magasabb szintű mintaváltozata","weaknesses":["visszatérő hibakategóriák röviden, magyarul"]}`,
  };
}

export function shadowSentences(code, level, topic) {
  const L = lang(code);
  return {
    role: 'fast', temperature: 1, system: SYSTEM,
    prompt: `Adj 5 ${L.name} mondatot árnyékoláshoz (shadowing), ${level} szinten${topic ? `, téma: ${topic}` : ''}. Legyenek gyakori, hasznos, természetes mondatok, fokozódó hosszal, a nehéz hangokat is gyakoroltassák.
JSON: {"items":[{"sentence":"…","hu":"…","focus_hu":"mire figyelj a kiejtésben (röviden)"}]}`,
  };
}

export function pronunciation(code, level, sentence, wavB64) {
  const L = lang(code);
  return {
    role: 'text', temperature: 0.1, system: SYSTEM,
    parts: [
      { text: `A tanuló (${level} szint, magyar anyanyelvű) ezt a ${L.name} mondatot próbálta kimondani: "${sentence}".
Hallgasd meg a felvételt, és értékeld a kiejtést, a hangsúlyt, az intonációt és a folyékonyságot. Légy igazságos, de bátorító. Ha a felvétel üres vagy nem a mondat hangzik el, jelezd.
JSON: {"transcript":"amit ténylegesen hallottál","score":0-100,"words":[{"w":"szó a mondatból","ok":true,"tip_hu":"ha nem jó: hogyan ejtsd (magyar hangokkal közelítve)"}],"feedback_hu":"2-3 mondat","weakness":"fő kiejtési probléma röviden vagy üres"}` },
      { inlineData: { mimeType: 'audio/wav', data: wavB64 } },
    ],
  };
}

export function transcribe(code, wavB64) {
  const L = lang(code);
  return {
    role: 'transcribe', temperature: 0,
    parts: [
      { text: `Pontos átirat (${L.name} nyelv). Csak az elhangzott szöveget add vissza, javítás nélkül, a hibákkal együtt.` },
      { inlineData: { mimeType: 'audio/wav', data: wavB64 } },
    ],
  };
}

export function speakingEval(code, level, task, transcript) {
  const L = lang(code);
  return {
    role: 'text', temperature: 0.2, system: SYSTEM,
    prompt: `A tanuló szóban válaszolt (${L.name}, ${level} szint). Feladat: "${task}". Átirat: """${transcript}"""
Értékeld a szóbeli teljesítményt (tartalom, szókincs, nyelvtan, folyékonyság az átirat alapján).
JSON: {"score":0-100,"cefr":"…","better":"természetes, javított változat","errors":[{"orig":"…","fix":"…","explain_hu":"…"}],"feedback_hu":"2-3 mondat","weaknesses":["…"]}`,
  };
}

export function speakingTopic(u, c) {
  const L = lang(u.current);
  return {
    role: 'fast', temperature: 1, system: SYSTEM,
    prompt: `Adj egy 30–60 másodperces szóbeli feladatot ${L.name} nyelven, ${c.level} szinten, cél: ${goalText(u)}.
JSON: {"task_hu":"feladat magyarul","task":"ugyanez célnyelven","hints":["3 hasznos kifejezés célnyelven"]}`,
  };
}

export function tutorSystem(u, c, sc) {
  const L = lang(u.current);
  const slow = ['A1', 'A2'].includes(c.level);
  return `Te KokoAI vagy, barátságos ${L.name} (${L.native}) beszélgetőtárs és nyelvtanár. A tanuló neve: ${u.name}, anyanyelve magyar, szintje: ${c.level}.
Helyzet: ${sc.title} – ${sc.desc}. ${sc.id === 'szabad' ? 'Kérdezz a tanuló érdeklődéséről, és arra építs.' : 'Játszd el a helyzet másik szereplőjét (pl. pincér, recepciós, interjúztató).'}
Szabályok:
- ${L.name} nyelven beszélj, ${slow ? 'lassan, rövid, egyszerű mondatokkal, gyakori szavakkal' : 'természetes tempóban, a szintjéhez igazítva'}.
- Egyszerre csak 1–3 mondat, mindig zárj egy kérdéssel, hogy a tanuló beszéljen többet (ő beszéljen többet, mint te).
- Hibánál használj átfogalmazást (recast): ismételd meg helyesen a mondatát természetesen, és folytasd. Csak ismétlődő hibánál adj egyetlen rövid magyar magyarázatot.
- Ha a tanuló magyarul kérdez vagy elakad, segíts röviden magyarul, majd térj vissza a célnyelvre.
- Gyenge pontjai: ${c.weaknesses.slice(0, 4).map((w) => w.k).join('; ') || 'nincs adat'} – adj alkalmat ezek gyakorlására.`;
}

export function liveReview(code, level, transcript) {
  const L = lang(code);
  return {
    role: 'text', temperature: 0.2, system: SYSTEM,
    prompt: `Egy ${L.name} élő beszélgetés átirata (tanuló szintje ${level}). T = tanuló, K = KokoAI.
"""${transcript}"""
Adj rövid összegzést a tanuló teljesítményéről.
JSON: {"score":0-100,"feedback_hu":"2-3 mondat","errors":[{"orig":"…","fix":"…","explain_hu":"…"}],"vocab":[{"term":"hasznos kifejezés a beszélgetésből","hu":"…","example":"…","ex_hu":"…"}],"weaknesses":["…"]}`,
  };
}

export function levelUpPool(code, level) {
  const i = LEVELS.indexOf(level);
  return placementPool(code, [LEVELS[i], LEVELS[Math.min(5, i + 1)]], 5);
}

export function wordLookup(code, word, level) {
  const L = lang(code);
  return {
    role: 'fast', temperature: 0.2, system: SYSTEM,
    prompt: `Magyarázd el röviden a(z) ${L.name} "${word}" kifejezést egy ${level} szintű tanulónak.
JSON: {"term":"szótári alak","hu":"jelentés(ek)","example":"példamondat","ex_hu":"fordítás","note_hu":"nyelvtani/használati megjegyzés röviden"}`,
  };
}
