// Kliensoldali hívások a /api végpontokra + hang (felolvasás, felvétel)

let accessCode = '';
try { accessCode = localStorage.getItem('kokoai.code') || ''; } catch {}
export function setAccessCode(c) { accessCode = c; try { localStorage.setItem('kokoai.code', c); } catch {} }

let onNeedCode = null;
export function setCodeHandler(fn) { onNeedCode = fn; }

async function post(path, body, retry = true) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-access-code': accessCode },
    body: JSON.stringify(body),
  });
  if (r.status === 401 && retry && onNeedCode) {
    const c = await onNeedCode();
    if (c) { setAccessCode(c); return post(path, body, false); }
  }
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export async function gen(opts) {
  return post('/api/gen', opts);
}

// JSON-válasz robusztus kinyerése
export async function genJSON(opts) {
  const { text, model } = await gen({ ...opts, json: true });
  let s = (text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { const o = JSON.parse(s); o.__model = model; return o; } catch {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { const o = JSON.parse(s.slice(a, b + 1)); o.__model = model; return o; }
  throw new Error('A modell válasza nem értelmezhető JSON.');
}

export async function genImage(prompt) {
  const { images } = await gen({ image: true, prompt });
  if (!images?.length) throw new Error('nem jött kép');
  return `data:${images[0].mime || 'image/png'};base64,${images[0].data}`;
}

export function token() { return post('/api/token', {}); }

// ---------- Felolvasás (Gemini TTS, tartalék: böngésző hangja) ----------
let ctx = null;
let current = null;
const cache = new Map();
export function audioCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!ctx || ctx.state === 'closed') ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function pcmToBuffer(b64, rate) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const i16 = new Int16Array(u8.buffer, 0, Math.floor(u8.length / 2));
  const c = audioCtx();
  const buf = c.createBuffer(1, i16.length, rate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < i16.length; i++) ch[i] = i16[i] / 0x8000;
  return buf;
}
export function stopSpeaking() {
  try { current?.stop(); } catch {}
  current = null;
  try { speechSynthesis.cancel(); } catch {}
}
const TTS_OFF = 'kokoai.ttsoff';
const ttsOff = () => { try { return localStorage.getItem(TTS_OFF) === new Date().toISOString().slice(0, 10); } catch { return false; } };
export async function speak(text, { voice = 'Kore', bcp = 'en-US', rate = 1, slow = false } = {}) {
  stopSpeaking();
  const c = audioCtx();
  const key = voice + '|' + (slow ? 's|' : '') + text;
  try {
    let buf = cache.get(key);
    if (!buf && ttsOff()) throw new Error('Gemini TTS napi keret elfogyott');
    if (!buf) {
      const j = await post('/api/tts', { text, voice, style: slow ? 'Say slowly and clearly, like a language teacher' : undefined });
      buf = pcmToBuffer(j.audio, j.rate);
      cache.set(key, buf);
    }
    return await new Promise((resolve) => {
      const s = c.createBufferSource();
      s.buffer = buf;
      s.playbackRate.value = rate;
      s.connect(c.destination);
      s.onended = () => { if (current === s) current = null; resolve(); };
      current = s;
      s.start();
    });
  } catch (e) {
    console.warn('Gemini TTS nem elérhető, böngészőhang:', e.message);
    if (/429|quota|RESOURCE_EXHAUSTED/i.test(e.message)) { try { localStorage.setItem(TTS_OFF, new Date().toISOString().slice(0, 10)); } catch {} }
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = bcp;
      u.rate = slow ? 0.8 : rate;
      const v = speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith(bcp.slice(0, 2)));
      if (v) u.voice = v;
      u.onend = resolve; u.onerror = resolve;
      speechSynthesis.speak(u);
    });
  }
}

// ---------- Felvétel: 16 kHz mono WAV (a Gemini ezt biztosan érti) ----------
export class Recorder {
  async start(onLevel) {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const src = this.ctx.createMediaStreamSource(this.stream);
    const proc = this.ctx.createScriptProcessor(4096, 1, 1);
    this.chunks = [];
    this.rate = this.ctx.sampleRate;
    proc.onaudioprocess = (ev) => {
      const d = ev.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(d));
      if (onLevel) { let pk = 0; for (let i = 0; i < d.length; i += 8) pk = Math.max(pk, Math.abs(d[i])); onLevel(pk); }
    };
    src.connect(proc); proc.connect(this.ctx.destination);
    this.nodes = [src, proc];
    this.t0 = performance.now();
  }
  async stop() {
    this.nodes?.forEach((n) => n.disconnect());
    this.stream?.getTracks().forEach((t) => t.stop());
    try { await this.ctx?.close(); } catch {}
    const len = this.chunks.reduce((a, c) => a + c.length, 0);
    const all = new Float32Array(len);
    let o = 0; for (const c of this.chunks) { all.set(c, o); o += c.length; }
    const ratio = this.rate / 16000, n = Math.floor(len / ratio);
    const pcm = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      const v = Math.max(-1, Math.min(1, all[Math.floor(i * ratio)] || 0));
      pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    this.seconds = n / 16000;
    return wavBase64(pcm, 16000);
  }
}
function wavBase64(pcm, rate) {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  new Int16Array(buf, 44).set(pcm);
  const u8 = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
