// Procedural sound effects + calm generative background music (WebAudio, no external files).
let ctx: AudioContext | null = null;
let master: GainNode, sfxBus: GainNode, musicBus: GainNode;
let musicOn = true;
let musicTimer: ReturnType<typeof setTimeout> | null = null;

export function audioCtx() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noise(dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = "bandpass") {
  const c = audioCtx();
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(sfxBus); src.start();
}
function tone(freq: number, dur: number, vol: number, type: OscillatorType = "square", slide = 1, bus?: GainNode, when = 0) {
  const c = audioCtx();
  const t = c.currentTime + when;
  const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus ?? sfxBus); o.start(t); o.stop(t + dur + 0.05);
}

export type Material = "stone" | "wood" | "dirt" | "grass" | "sand" | "glass" | "leaves";
const MAT: Record<Material, [number, number]> = {
  stone: [1800, 2], wood: [600, 3], dirt: [500, 1], grass: [2500, 0.7], sand: [3500, 0.5], glass: [4500, 6], leaves: [3000, 0.6],
};
export const sfx = {
  dig(m: Material) { const [f, q] = MAT[m]; noise(0.12, f * (0.9 + Math.random() * 0.2), q, 0.5); },
  brk(m: Material) { const [f, q] = MAT[m]; noise(0.28, f, q, 0.9); if (m === "glass") for (let i = 0; i < 4; i++) tone(2000 + Math.random() * 2500, 0.15, 0.06, "triangle", 0.8, undefined, i * 0.03); },
  place(m: Material) { const [f, q] = MAT[m]; noise(0.1, f * 0.7, q, 0.7); },
  step(m: Material) { const [f, q] = MAT[m]; noise(0.07, f * 0.8, q, 0.18); },
  hit() { noise(0.1, 900, 1, 0.6); tone(180, 0.12, 0.15, "sawtooth", 0.5); },
  hurt() { tone(330, 0.18, 0.2, "square", 0.6); noise(0.1, 700, 1, 0.4); },
  eat() { for (let i = 0; i < 3; i++) setTimeout(() => noise(0.08, 1200, 2, 0.4), i * 120); },
  pop() { tone(500, 0.08, 0.15, "sine", 2.2); },
  explode() { noise(1.2, 120, 0.4, 2.2, "lowpass"); tone(60, 0.8, 0.5, "sine", 0.4); },
  fuse() { noise(0.4, 4000, 0.5, 0.3, "highpass"); },
  swing() { noise(0.12, 1800, 0.5, 0.15, "highpass"); },
  mob(type: string) {
    switch (type) {
      case "cow": tone(140, 0.7, 0.18, "sawtooth", 0.75); break;
      case "pig": tone(260, 0.25, 0.12, "sawtooth", 0.6); tone(240, 0.2, 0.1, "sawtooth", 0.6, undefined, 0.25); break;
      case "sheep": for (let i = 0; i < 4; i++) tone(420, 0.09, 0.08, "sawtooth", 0.95, undefined, i * 0.09); break;
      case "chicken": tone(1100, 0.08, 0.08, "triangle", 1.3); tone(1300, 0.08, 0.08, "triangle", 0.9, undefined, 0.1); break;
      case "zombie": tone(110, 0.9, 0.15, "sawtooth", 0.8); break;
      case "skeleton": for (let i = 0; i < 3; i++) noise(0.05, 2500, 4, 0.3); break;
      case "spider": noise(0.4, 1500, 1, 0.3); break;
    }
  },
};

// --- Music: slow pentatonic piano-ish phrases over soft pads (C418-like mood) ---
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
function pianoNote(midi: number, when: number, vol: number) {
  const c = audioCtx();
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const t = c.currentTime + when;
  for (const [mul, v] of [[1, 1], [2, 0.3], [3, 0.12]] as const) {
    const o = c.createOscillator(); o.type = "sine"; o.frequency.value = f * mul;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    o.connect(g).connect(musicBus); o.start(t); o.stop(t + 3.6);
  }
}
function pad(midi: number, when: number, dur: number) {
  const c = audioCtx();
  const t = c.currentTime + when;
  const o = c.createOscillator(); o.type = "triangle"; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.08, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(musicBus); o.start(t); o.stop(t + dur + 0.1);
}
function phrase() {
  if (!musicOn || !ctx) return;
  const root = [48, 53, 45, 50][Math.floor(Math.random() * 4)];
  pad(root, 0, 10); pad(root + 7, 0.5, 10);
  let t = 0.5;
  const n = 5 + Math.floor(Math.random() * 6);
  for (let i = 0; i < n; i++) {
    pianoNote(root + 12 + SCALE[Math.floor(Math.random() * SCALE.length)], t, 0.18);
    if (Math.random() < 0.3) pianoNote(root + 24 + SCALE[Math.floor(Math.random() * 5)], t + 0.02, 0.08);
    t += [0.6, 0.9, 1.2, 1.8][Math.floor(Math.random() * 4)];
  }
  musicTimer = setTimeout(phrase, (t + 4 + Math.random() * 10) * 1000);
}
export function startMusic() {
  audioCtx();
  if (musicTimer || !musicOn) return;
  musicTimer = setTimeout(phrase, 1500);
}
export function toggleMusic() {
  musicOn = !musicOn;
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
  if (musicOn) startMusic();
  return musicOn;
}
export function stopAudio() {
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
}
