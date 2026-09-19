// Közös segédek a Vercel függvényekhez (nincs npm függőség).
export const API = 'https://generativelanguage.googleapis.com/v1beta';

// Modell-szerepek → modellnevek (env-ből felülírhatók). Az első a preferált, a többi tartalék.
// Ingyenes keret: a Flash-modellek napi ~20 kérés/modell, a Flash-Lite 500. Ezért a Flash-verziók láncban
// követik egymást (mindegyiknek külön kerete van), a végén a Flash-Lite a biztos tartalék. Pro és kép: 0 kvóta.
const FLASH = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview'];
const LITE = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
export const MODELS = {
  text: [process.env.GEMINI_TEXT_MODEL, ...FLASH, ...LITE],
  fast: [process.env.GEMINI_FAST_MODEL, ...LITE, ...FLASH],
  pro: [process.env.GEMINI_PRO_MODEL, ...FLASH, ...LITE],
  tts: [process.env.GEMINI_TTS_MODEL, 'gemini-3.1-flash-tts-preview'],
  transcribe: [process.env.GEMINI_TRANSCRIBE_MODEL, ...LITE, ...FLASH],
};
export const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';
export const TRANSLATE_MODEL = process.env.GEMINI_TRANSLATE_MODEL || 'gemini-3.5-live-translate-preview';

// Túlterhelt (503) vagy kvótán túli (429) modellt egy ideig kihagyunk, hogy ne lassítson minden kérést.
const cooldown = new Map();
export function list(role) {
  const all = [...new Set((MODELS[role] || MODELS.text).filter(Boolean))];
  const ok = all.filter((m) => !(cooldown.get(m) > Date.now()));
  return ok.length ? ok : all;
}

export function checkAccess(req, res) {
  const code = process.env.ACCESS_CODE;
  if (code && req.headers['x-access-code'] !== code) {
    res.status(401).json({ error: 'hozzaferesi-kod' });
    return false;
  }
  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ error: 'Hiányzik a GEMINI_API_KEY környezeti változó.' });
    return false;
  }
  return true;
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

// generateContent a szerep modelljeivel sorban; 404/400-modellhiba esetén a következőre lép.
export async function generate(role, body) {
  let last;
  for (const model of list(role)) {
    const r = await fetch(`${API}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { model, data: j };
    last = { status: r.status, model, error: j.error?.message || JSON.stringify(j) };
    console.log('[gemini]', model, r.status, last.error.slice(0, 90));
    if (r.status === 503) cooldown.set(model, Date.now() + 5 * 60 * 1000);
    if (r.status === 429) cooldown.set(model, Date.now() + (/per.?day|PerDay/i.test(last.error) ? 6 * 3600 : 60) * 1000);
    // csak "modell nem elérhető / nem támogatott" jellegű hibánál próbálunk tartalékot
    if (![400, 403, 404, 429, 500, 503].includes(r.status)) break;
  }
  const e = new Error(`${last?.model}: ${last?.error}`);
  e.status = last?.status || 500;
  throw e;
}
