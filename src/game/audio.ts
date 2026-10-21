// Original Minecraft sound samples (OGG, loaded from CDN) with tiny procedural fallbacks while loading.
import SOUNDS_JSON from "./packs/sounds.json";

const SOUNDS = SOUNDS_JSON as Record<string, string[]>;
let ctx: AudioContext | null = null;
let master: GainNode, sfxBus: GainNode;
let musicOn = true;
let musicTimer: ReturnType<typeof setTimeout> | null = null;
let musicEl: HTMLAudioElement | null = null;

export function audioCtx() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

const bufs = new Map<string, AudioBuffer>();
const loading = new Set<string>();
function load(url: string) {
  if (bufs.has(url) || loading.has(url)) return;
  loading.add(url);
  fetch(url)
    .then((r) => r.arrayBuffer())
    .then((a) => audioCtx().decodeAudioData(a))
    .then((b) => {
      bufs.set(url, b);
    })
    .catch(() => loading.delete(url));
}
export function preloadSounds() {
  for (const [k, list] of Object.entries(SOUNDS)) if (k !== "music") list.forEach(load);
}

/** Play a random variant of a sound key. Returns false when the sample is not ready yet. */
function play(key: string, vol = 1, pitch = 1, vary = 0.1) {
  const list = SOUNDS[key];
  if (!list?.length) return false;
  const url = list[Math.floor(Math.random() * list.length)];
  const b = bufs.get(url);
  if (!b) {
    load(url);
    return false;
  }
  const c = audioCtx();
  const src = c.createBufferSource();
  src.buffer = b;
  src.playbackRate.value = pitch * (1 - vary + Math.random() * vary * 2);
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(g).connect(sfxBus);
  src.start();
  return true;
}

function noise(dur: number, freq: number, vol: number) {
  const c = audioCtx();
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(sfxBus);
  src.start();
}

export type Material =
  "stone" | "wood" | "dirt" | "grass" | "sand" | "glass" | "leaves" | "cloth" | "snow";
/** Minecraft sound group used by each material. */
const GROUP: Record<Material, string> = {
  stone: "stone",
  wood: "wood",
  dirt: "gravel",
  grass: "grass",
  sand: "sand",
  glass: "stone",
  leaves: "grass",
  cloth: "cloth",
  snow: "snow",
};
export const sfx = {
  dig(m: Material) {
    if (!play("dig." + GROUP[m], 0.35, 0.5)) {
      noise(0.1, 1200, 0.3);
    }
  },
  brk(m: Material) {
    const played = m === "glass" ? play("glass", 0.9) : play("dig." + GROUP[m], 0.9, 0.8);
    if (!played) {
      noise(0.25, 1200, 0.7);
    }
  },
  place(m: Material) {
    if (!play("dig." + GROUP[m], 0.9, 0.8)) {
      noise(0.1, 900, 0.5);
    }
  },
  step(m: Material) {
    if (!play("step." + GROUP[m], 0.3)) {
      noise(0.06, 900, 0.12);
    }
  },
  hit() {
    if (!play("swing.strong", 0.6)) {
      noise(0.1, 900, 0.5);
    }
  },
  hurt() {
    if (!play("hurt", 0.9)) {
      noise(0.12, 700, 0.5);
    }
  },
  eat() {
    for (let i = 0; i < 3; i++) setTimeout(() => play("eat", 0.6), i * 180);
    setTimeout(() => play("burp", 0.5), 650);
  },
  pop() {
    play("pop", 0.4, 1.4, 0.3);
  },
  explode() {
    if (!play("explode", 1.2)) {
      noise(1, 120, 2);
    }
  },
  fuse() {
    play("fuse", 0.9, 1, 0);
  },
  swing() {
    play("swing.weak", 0.4);
  },
  mob(type: string) {
    play("mob." + type, 0.7);
  },
  mobHurt(type: string) {
    if (!play("hurt." + type, 0.8)) {
      play("mob." + type, 0.8, 1.2);
    }
  },
};

// --- Music: original calm C418 tracks streamed, with long silent gaps like the real game ---
function nextTrack(delay: number) {
  if (musicTimer) clearTimeout(musicTimer);
  musicTimer = setTimeout(() => {
    musicTimer = null;
    if (!musicOn) return;
    const list = SOUNDS["music"] ?? [];
    if (!list.length) return;
    musicEl = new Audio(list[Math.floor(Math.random() * list.length)]);
    musicEl.volume = 0.35;
    musicEl.onended = () => nextTrack(60_000 + Math.random() * 120_000);
    void musicEl.play().catch(() => nextTrack(5000));
  }, delay);
}
export function startMusic() {
  audioCtx();
  if (musicTimer || musicEl || !musicOn) return;
  nextTrack(2000);
}
export function toggleMusic() {
  musicOn = !musicOn;
  if (!musicOn) stopAudio();
  else startMusic();
  return musicOn;
}
export function stopAudio() {
  if (musicTimer) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
  if (musicEl) {
    musicEl.pause();
    musicEl = null;
  }
}
