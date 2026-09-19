// Rövid lejáratú, egyszer használatos token a Gemini Live-hoz (beszélgetés + tolmács).
// A GEMINI_API_KEY soha nem jut ki a böngészőbe.
import { checkAccess, LIVE_MODEL, TRANSLATE_MODEL } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
  if (!checkAccess(req, res)) return;
  try {
    const now = Date.now();
    const r = await fetch('https://generativelanguage.googleapis.com/v1alpha/auth_tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString(),
      }),
    });
    const j = await r.json();
    if (!r.ok) return res.status(500).json({ error: j.error?.message || JSON.stringify(j) });
    res.status(200).json({ token: j.name, live: LIVE_MODEL, translate: TRANSLATE_MODEL });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
