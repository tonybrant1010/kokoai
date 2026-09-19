// Felolvasás Gemini TTS-sel → 24 kHz 16 bites PCM (base64).
import { checkAccess, readBody, generate } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
  if (!checkAccess(req, res)) return;
  try {
    const { text, voice = 'Kore', style } = await readBody(req);
    if (!text || text.length > 1200) return res.status(400).json({ error: 'szöveg 1–1200 karakter' });
    const body = {
      contents: [{ role: 'user', parts: [{ text: style ? `${style}: ${text}` : text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    };
    const { model, data } = await generate('tts', body);
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) return res.status(502).json({ error: 'nincs hang a válaszban' });
    const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1]) || 24000;
    res.setHeader('cache-control', 'no-store');
    res.status(200).json({ model, audio: part.inlineData.data, rate });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
