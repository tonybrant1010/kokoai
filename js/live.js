// Gemini Live: valós idejű hang (mikrofon 16 kHz be, 24 kHz PCM ki).
// Két mód: 'tutor' (beszélgetőtárs) és 'translate' (élő tolmács).
import { token } from './api.js';

const SDK = 'https://esm.sh/@google/genai@2';

function b64FromInt16(i16) {
  const u8 = new Uint8Array(i16.buffer);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function int16FromB64(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Int16Array(u8.buffer);
}

export class LiveSession {
  constructor({ onState, onUser, onModel, onTurnEnd, onLevel, onDiag }) {
    Object.assign(this, { onState, onUser, onModel, onTurnEnd, onLevel, onDiag });
    this.session = null;
    this.sources = new Set();
    this.nextTime = 0;
  }
  get active() { return !!this.session; }

  async start({ mode = 'tutor', systemInstruction, voice = 'Kore', targetLanguageCode, kickoff }) {
    this.onState('kapcsolodik');
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ sampleRate: 24000 });
    await this.ctx.resume();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.connect(this.ctx.destination);

    let t;
    try { t = await token(); } catch (e) { this.stop(); throw e; }
    const model = mode === 'translate' ? t.translate : t.live;
    this.onDiag?.('Csatlakozás: ' + model);
    const { GoogleGenAI, Modality } = await import(SDK);
    const ai = new GoogleGenAI({ apiKey: t.token, httpOptions: { apiVersion: 'v1alpha' } });

    const config = {
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    };
    if (mode === 'translate') {
      config.translationConfig = { targetLanguageCode, echoTargetLanguage: true };
    } else {
      config.systemInstruction = systemInstruction;
      config.speechConfig = { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } };
    }

    let micStarted = false;
    const ready = async () => {
      if (micStarted || !this.session || !this._setup) return;
      micStarted = true;
      try {
        await this._startMic();
        if (kickoff) this.session?.sendRealtimeInput({ text: kickoff });
      } catch (e) { this.onDiag?.('Mikrofon hiba: ' + e.message); this.stop(); }
    };
    this.session = await ai.live.connect({
      model,
      config,
      callbacks: {
        onopen: () => this.onState('hallgat'),
        onmessage: (m) => {
          if (m.setupComplete) { this._setup = true; ready(); }
          this._onMessage(m);
        },
        onerror: (e) => { this.onDiag?.('Hiba: ' + (e?.message || e?.type || e)); this.onState('hiba'); },
        onclose: (e) => { if (this.session) this.onDiag?.(`Kapcsolat bezárva (${e.code}) ${e.reason || ''}`); this.stop(); },
      },
    });
    ready();
    this._levelLoop();
  }

  async _startMic() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    this.stream = stream;
    const AC = window.AudioContext || window.webkitAudioContext;
    const inCtx = new AC();
    if (inCtx.state === 'suspended') await inCtx.resume();
    this.inCtx = inCtx;
    const src = inCtx.createMediaStreamSource(stream);
    const proc = inCtx.createScriptProcessor(4096, 1, 1);
    const rate = inCtx.sampleRate;
    proc.onaudioprocess = (ev) => {
      if (!this.session || this.muted) return;
      const input = ev.inputBuffer.getChannelData(0);
      const ratio = rate / 16000, n = Math.max(1, Math.round(input.length / ratio));
      const out = new Int16Array(n);
      for (let i = 0; i < n; i++) {
        const x = i * ratio, l = Math.floor(x), r2 = Math.min(l + 1, input.length - 1), m = x - l;
        const v = Math.max(-1, Math.min(1, input[l] * (1 - m) + input[r2] * m));
        out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
      }
      this.session.sendRealtimeInput({ audio: { data: b64FromInt16(out), mimeType: 'audio/pcm;rate=16000' } });
    };
    src.connect(proc);
    proc.connect(inCtx.destination);
    this.micNodes = [src, proc];
  }

  sendText(text) { this.session?.sendRealtimeInput({ text }); }

  _onMessage(m) {
    const sc = m.serverContent;
    if (!sc) return;
    if (sc.interrupted) this._stopPlayback();
    for (const p of sc.modelTurn?.parts || []) if (p.inlineData?.data) this._play(int16FromB64(p.inlineData.data));
    if (sc.inputTranscription?.text) this.onUser?.(sc.inputTranscription.text);
    if (sc.outputTranscription?.text) this.onModel?.(sc.outputTranscription.text);
    if (sc.turnComplete) this.onTurnEnd?.();
  }

  _play(i16) {
    const f32 = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 0x8000;
    const buf = this.ctx.createBuffer(1, f32.length, 24000);
    buf.copyToChannel(f32, 0);
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.connect(this.analyser);
    const t = Math.max(this.ctx.currentTime + 0.02, this.nextTime);
    s.start(t);
    this.nextTime = t + buf.duration;
    this.sources.add(s);
    s.onended = () => this.sources.delete(s);
  }
  _stopPlayback() {
    for (const s of this.sources) { try { s.stop(); } catch {} }
    this.sources.clear();
    this.nextTime = 0;
  }
  _levelLoop() {
    const data = new Uint8Array(this.analyser.fftSize);
    let last = '';
    const tick = () => {
      if (!this.ctx) return;
      this.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += ((v - 128) / 128) ** 2;
      this.onLevel?.(Math.min(1, Math.sqrt(sum / data.length) * 4));
      const st = this.ctx.currentTime < this.nextTime ? 'beszel' : 'hallgat';
      if (st !== last && this.session) { last = st; this.onState(st); }
      requestAnimationFrame(tick);
    };
    tick();
  }
  stop() {
    const had = this.session || this.ctx;
    const s = this.session;
    this.session = null;
    try { s?.close(); } catch {}
    this._stopPlayback();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.micNodes?.forEach((n) => n.disconnect());
    try { this.ctx?.close(); } catch {}
    try { this.inCtx?.close(); } catch {}
    this.ctx = null; this.inCtx = null; this._setup = false;
    this.onLevel?.(0);
    if (had) this.onState('ki');
  }
}
