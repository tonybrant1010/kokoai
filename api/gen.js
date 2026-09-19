// Szöveg / JSON / kép / hang-elemzés a Gemini-vel. A kulcs csak a szerveren van.
import { checkAccess, readBody, generate } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
  if (!checkAccess(req, res)) return;
  try {
    const { role = 'text', system, parts, prompt, json, temperature, image } = await readBody(req);
    const userParts = parts || [{ text: prompt || '' }];
    const body = {
      contents: [{ role: 'user', parts: userParts }],
      generationConfig: {},
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    if (typeof temperature === 'number') body.generationConfig.temperature = temperature;
    if (json) body.generationConfig.responseMimeType = 'application/json';
    if (image) body.generationConfig.responseModalities = ['IMAGE', 'TEXT'];

    const { model, data } = await generate(image ? 'image' : role, body);
    const out = data.candidates?.[0]?.content?.parts || [];
    const text = out.filter((p) => p.text && !p.thought).map((p) => p.text).join('');
    const images = out.filter((p) => p.inlineData).map((p) => ({ data: p.inlineData.data, mime: p.inlineData.mimeType }));
    res.status(200).json({ model, text, images });
  } catch (e) {
    res.status(e.status && e.status < 500 ? e.status : 500).json({ error: String(e?.message || e) });
  }
}
