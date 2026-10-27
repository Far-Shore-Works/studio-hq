// Sound. Kenney CC0 impact samples (assets/sfx) for hits, a tiny WebAudio synth for the rest.
// The game only calls sfx(name, strength 0..1); if a sample is missing the synth covers it.
let ctx = null, muted = false;
const buffers = {};
const FILES = {
  glass: ['impactGlass_medium_000', 'impactGlass_medium_001'],
  wood: ['impactWood_heavy_000', 'impactWood_heavy_001'],
  stone: ['impactPlate_heavy_000', 'impactPlate_heavy_001'],
  bonk: ['impactGeneric_light_000'],
  thunk: ['impactPunch_heavy_000'],
  soft: ['impactSoft_heavy_000'],
};
let loading = false, n = 0;
export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }
export function unlock() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    if (!loading) { loading = true; load(); }
  } catch { /* no audio */ }
}
async function load() {
  for (const [name, files] of Object.entries(FILES)) {
    buffers[name] = [];
    for (const f of files) {
      try { const r = await fetch(`assets/sfx/${f}.ogg`); buffers[name].push(await ctx.decodeAudioData(await r.arrayBuffer())); } catch { /* synth fallback */ }
    }
  }
}
function sample(name, vol, rate) {
  const list = buffers[name];
  if (!list || !list.length) return false;
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = list[n++ % list.length]; s.playbackRate.value = rate; g.gain.value = vol;
  s.connect(g).connect(ctx.destination); s.start();
  return true;
}
export function sfx(name, p = 1) {
  if (muted || !ctx) return;
  try {
    const rate = 0.9 + ((n * 7) % 5) * 0.05;
    if (name === 'glass' && sample('glass', 0.55, rate)) return;
    if (name === 'wood' && sample('wood', 0.7, rate)) return;
    if (name === 'stone' && sample('stone', 0.75, rate)) return;
    if (name === 'bonk' && sample('bonk', 0.6, rate)) return;
    if (name === 'thunk' && sample('thunk', 0.5 + 0.4 * p, 0.85 + 0.2 * (1 - p))) return;
    (SOUNDS[name] || (() => {}))(ctx, p);
  } catch { /* ignore */ }
}

function tone(c, { f = 440, f2 = null, t = 0.15, type = 'sine', v = 0.2, at = 0 }) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, c.currentTime + at);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, c.currentTime + at + t);
  g.gain.setValueAtTime(v, c.currentTime + at); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + t);
  o.connect(g).connect(c.destination); o.start(c.currentTime + at); o.stop(c.currentTime + at + t + 0.02);
}
function noise(c, { t = 0.2, v = 0.2, lp = 2000, at = 0 }) {
  const len = Math.floor(c.sampleRate * t), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = lp; g.gain.value = v; s.buffer = b;
  s.connect(f).connect(g).connect(c.destination); s.start(c.currentTime + at);
}
const SOUNDS = {
  pull(c, p) { tone(c, { f: 180 + p * 260, f2: 220 + p * 300, t: 0.05, type: 'triangle', v: 0.05 }); },
  launch(c) { tone(c, { f: 520, f2: 140, t: 0.18, type: 'triangle', v: 0.18 }); noise(c, { t: 0.12, v: 0.08, lp: 3000 }); },
  thunk(c, p) { tone(c, { f: 110, f2: 45, t: 0.22, type: 'sine', v: 0.45 * Math.min(1, 0.4 + p) }); noise(c, { t: 0.1, v: 0.18 * p, lp: 900 }); },
  crack(c) { noise(c, { t: 0.14, v: 0.22, lp: 4500 }); tone(c, { f: 900, f2: 300, t: 0.06, type: 'square', v: 0.06 }); },
  glass(c) { tone(c, { f: 1800, f2: 1200, t: 0.2, type: 'triangle', v: 0.08 }); noise(c, { t: 0.12, v: 0.1, lp: 8000 }); },
  wood(c) { noise(c, { t: 0.14, v: 0.22, lp: 3000 }); tone(c, { f: 260, f2: 120, t: 0.1, type: 'square', v: 0.07 }); },
  stone(c) { noise(c, { t: 0.18, v: 0.24, lp: 1800 }); tone(c, { f: 160, f2: 70, t: 0.14, type: 'sine', v: 0.2 }); },
  rumble(c, p) { noise(c, { t: 0.4, v: 0.14 * p, lp: 500 }); tone(c, { f: 70, f2: 38, t: 0.4, type: 'sine', v: 0.2 * p }); },
  bonk(c) { tone(c, { f: 320, f2: 130, t: 0.12, type: 'sine', v: 0.25 }); },
  star(c) { tone(c, { f: 880, t: 0.12, type: 'triangle', v: 0.12 }); tone(c, { f: 1320, t: 0.2, type: 'triangle', v: 0.12, at: 0.08 }); },
  win(c) { [523, 659, 784, 1047].forEach((f, i) => tone(c, { f, t: 0.22, type: 'triangle', v: 0.14, at: i * 0.1 })); },
  miss(c) { tone(c, { f: 300, f2: 180, t: 0.3, type: 'triangle', v: 0.12 }); },
};
