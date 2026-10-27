// The game: one day, three throws. Input, state machine, animation loop, overlays.
import { C } from './palette.js';
import { drawScene, anchorScreen, TAU } from './render.js';
import { drawObject } from './sprites.js';
import { quantizePull, powerNumber, noAirArc, ANCHOR_H, G, MIN_PULL, V_MAX, PULL_MAX, launchVelocity, fsqrt } from './physics.js';
import { throwAt, fractionDown, CELL, alive } from './tower.js';
import { pullToCross, typicalEnergy } from './calibrate.js';
import { buildPlan, blockViews, projectileAt, makeParticles, chipColor } from './anim.js';
import { makeRng, hash32, dragClass, TWIST_TEXT, puzzleSig } from './daily.js';
import { sfx, unlock, setMuted, isMuted } from './audio.js';
import { loadDay, saveDay, quarantine } from './store.js';
import { validateShots } from './verify.js';
import { showResults } from './results.js';
import { describeCard } from './card.js';
import { Collapse, spriteMetres } from './sim.js';
import { chooseDummies, standPose, lyingPose, supportAt, poseBottom } from './dummy.js';

const $ = (id) => document.getElementById(id);
const TIER_NAME = { 1: 'glass', 2: 'wood', 3: 'stone' };
const pct = (x) => Math.round(x * 100);

const starSvg = (cls) => `<svg viewBox="0 0 24 24" class="${cls}"><path stroke="#2F4B6E" stroke-width="1.6" stroke-linejoin="round" d="M12 2.6l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.7 6.2 20.1l1.4-6.4L2.7 9.3l6.5-.7z"/></svg>`;

export class Game {
  constructor(puzzle, opts = {}) {
    this.puzzle = puzzle; this.opts = opts; this.today = opts.today || puzzle.key; this.ns = opts.practice ? 'practice' : 'day';
    this.cv = $('cv'); this.ctx = this.cv.getContext('2d');
    this.key = puzzle.key;
    this.tower = puzzle.tower;
    this.tower0 = puzzle.tower;                   // geometry reference (x0, width)
    this.towerH = Math.max(...puzzle.tower.blocks.map((b) => b.r0 + b.h));
    this.i = 0; this.mode = 'aim'; this.deltas = []; this.shots = []; this.summaries = [];
    this.sel = 0; this.used = new Set(); this.thrown = [];
    this.pull = null; this.plan = null; this.t = 0; this.time = 0;
    this.cam = { cx: 0, ppm: 10 }; this.camTarget = { cx: 0, ppm: 10 };
    this.rnd = makeRng(hash32(this.key + '|fx'));
    this.fx = makeParticles(this.rnd);
    this.shake = { amp: 0 };
    this.M = typeof window !== 'undefined' && window.Matter ? window.Matter : null;   // vendored matter.js; without it the old kinematic collapse is used
    this.sim = null; this.debris = []; this.restProj = null; this.slow = null; this.kick = 0; this.flash = 0; this.hitStop = 0; this.sq = null;
    this.dummies = chooseDummies(puzzle.tower, puzzle.key);
    this.hist = [];
    this.perf = { n: 0, ms: 0, worst: 0 };
    this.R = 110;
    this.resize(); this.fitCam(true);
    window.addEventListener('resize', () => { this.resize(); if (this.mode === 'aim') this.fitCam(true); });
    this.bindInput();
    this.restore();
    this.introT = this.thrown.length === 0 && this.mode === 'aim' ? 0 : 9;
    setMuted(this.loadMute());
    this.bindMute();
    this.warmMats();
    requestAnimationFrame((n) => { this.last = n; this.tick(n); });
    window.__topple = this;                       // test hook
  }

  loadMute() { try { return localStorage.getItem('topple:v1:mute') === '1'; } catch { return false; } }
  bindMute() {
    const b = $('muteBtn'); if (!b) return;
    const SPK = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 9v6h4l5 4V5L8 9z" fill="#2F4B6E"/>';
    const paint = () => { b.innerHTML = SPK + (isMuted() ? '<path d="M16 9l5 6M21 9l-5 6" stroke="#E5484D" stroke-width="2.4" stroke-linecap="round"/>' : '<path d="M16 9c1.6 1.6 1.6 4.4 0 6M18.5 6.5c3.2 3.2 3.2 8.8 0 12" stroke="#2F4B6E" stroke-width="2" fill="none" stroke-linecap="round"/>') + '</svg>'; b.setAttribute('aria-label', isMuted() ? 'Sound off' : 'Sound on'); };
    paint();
    b.onclick = () => { setMuted(!isMuted()); try { localStorage.setItem('topple:v1:mute', isMuted() ? '1' : '0'); } catch { /* ignore */ } paint(); unlock(); sfx('pull', 0.4); };
  }

  // ---- setup ------------------------------------------------------------------------
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = this.cv.clientWidth; this.H = this.cv.clientHeight; this.dpr = dpr;
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
    this.portrait = this.H > this.W * 1.1;
    this.gyAim = this.H * (this.portrait ? 0.7 : 0.76);
    this.side = this.W > this.H * 1.3 && this.H < 560;      // short landscape: the sheet moves to the side
    this.gyReveal = this.H * (this.portrait ? 0.5 : this.side ? 0.84 : 0.58);
    this.gyTarget = this.mode === 'reveal' ? this.gyReveal : this.gyAim;
    if (this.gy === undefined) this.gy = this.gyTarget;
    this.R = Math.max(80, Math.min(150, Math.min(this.W, this.H) * 0.27));
  }
  fitView() {
    const T = this.tower0;
    // room on the left for the pouch to be pulled back (about 70% of a full pull)
    const pad = this.R * 0.7 + 26, xmax = T.x0 + T.width * CELL + 2.5;
    let ppm = (this.W - pad) / xmax;
    ppm = Math.min(ppm, (Math.min(this.gyAim, this.gyReveal) - 70) / (this.towerH * CELL + 3), 54);
    const xmin = -pad / ppm;
    return { cx: (xmin + xmax) / 2, ppm };
  }
  /** Close on the tower: it fills most of the width, with a little room to the left for what flies off. */
  impactView() {
    const T = this.tower0, tw = T.width * CELL;
    const ppm = Math.min(this.W / (tw + 3.2), (this.gyAim - (this.side ? 60 : 96)) / (this.towerH * CELL + 2.6), 90);
    return { cx: T.x0 + tw / 2 - 0.5 + (this.side ? (0.19 * this.W) / ppm : 0), ppm };
  }
  /** After the throw, with the result sheet covering the bottom of the screen. */
  revealView() {
    const T = this.tower0, tw = T.width * CELL;
    const ppm = Math.min(this.W / (tw + 3.2), (this.gyReveal - (this.side ? 60 : 96)) / (this.towerH * CELL + 2.4), 90);
    return { cx: T.x0 + tw / 2 - 0.3 + (this.side ? (0.19 * this.W) / ppm : 0), ppm };
  }
  /** Flight camera: starts wide on the slingshot, follows the object in, and ends close on the tower. */
  flyCamera(t, pose) {
    const plan = this.plan, imp = plan.res.impact, T = Math.max(0.25, imp ? imp.time : plan.flightEnd);
    const A = this.flyCam.fit, B = this.flyCam.imp;
    const p = Math.max(0, Math.min(1, t / T)), e = p * p * (3 - 2 * p);
    const ppm = A.ppm + (B.ppm - A.ppm) * Math.pow(e, 0.75);
    const lo = Math.min(A.cx, B.cx), hi = Math.max(A.cx, B.cx);
    let cx = Math.max(lo, Math.min(hi, pose.x + (0.16 * this.W) / ppm));
    if (p > 0.8) cx += (B.cx - cx) * Math.min(1, (p - 0.8) / 0.2);
    this.camTarget = { cx: imp || t < T ? cx : B.cx, ppm };
  }
  fitCam(snap) { this.camTarget = this.fitView(); if (snap) this.cam = { ...this.camTarget }; }

  restore() {
    let saved = loadDay(this.key, this.ns);
    this.sig = puzzleSig(this.puzzle);
    // A save is only replayed if it is well formed and was made on exactly this puzzle.
    if (saved && (saved.sig !== this.sig || validateShots(saved.shots, this.puzzle.objects.length, false))) { quarantine(this.key, this.ns); saved = null; }
    this.alreadyDone = !!(saved && saved.done);
    $('dayno').textContent = `#${this.puzzle.number}`;
    this.renderBanner();
    if (saved && saved.shots) {
      for (const sh of saved.shots) {
        const [px, py] = sh;
        const idx = Number.isInteger(sh[2]) && !this.used.has(sh[2]) ? sh[2] : this.puzzle.objects.findIndex((_, k) => !this.used.has(k));
        const res = throwAt(this.tower, this.puzzle.objects[idx], px, py, { g: this.puzzle.g, wind: this.puzzle.wind });
        this.hist.push({ tower: this.tower, shot: [px, py, idx] });
        this.deltas.push(res.delta); this.shots.push([px, py, idx]); this.summaries.push(this.summaryOf(res, this.puzzle.objects[idx]));
        this.used.add(idx); this.thrown.push(idx);
        this.tower = res.tower; this.i++;
        this.dummiesAfter(res);
        { const im = res.impact; this.ghost = { real: im ? res.flight.path.filter((q) => q.t <= im.time).concat([{ x: im.x, y: im.y }]) : res.flight.path, hit: im ? { x: im.x, y: im.y } : null }; }
      }
      this.rebuildDebris();
      if (this.thrown.length >= this.puzzle.objects.length || saved.done) { this.finish(true); return; }
    }
    this.startAim();
  }

  /** After a throw that was replayed from a save: dummies whose block was touched are lying where the tower left them. */
  dummiesAfter(res) {
    const touched = new Set(res.events.filter((e) => e.id !== undefined).map((e) => e.id));
    for (const d of this.dummies) {
      if (d.host === null || !touched.has(d.host)) continue;
      const sup = supportAt(res.tower, d.x, d.base, 0.2);
      d.pose = lyingPose(d.x, sup.y, d.seed); d.host = sup.id; d.base = sup.y; d.state = 'lying'; d.face = 'dizzy';
    }
  }
  /** A few chunks on the ground for every block that is gone, drawn the same way on every reload. */
  rebuildDebris() {
    const rnd = makeRng(hash32(this.key + '|debris'));
    this.debris = [];
    for (const b of this.tower.blocks) {
      if (b.alive) continue;
      const fill = b.key ? C.gold : b.tier === 1 ? C.glass : b.tier === 2 ? C.plank : C.stone;
      for (let i = 0; i < 3; i++) {
        const r = 0.14 + rnd() * 0.12, n = b.tier === 1 ? 3 : 5, a0 = rnd() * 6;
        const verts = []; for (let k = 0; k < n; k++) { const a = a0 + (k / n) * 6.283; verts.push([Math.cos(a) * r * (0.8 + rnd() * 0.4), Math.sin(a) * r * (0.8 + rnd() * 0.4)]); }
        this.debris.push({ x: this.tower0.x0 + (b.c0 + rnd() * b.w) * CELL + (rnd() - 0.5) * 1.5, y: r * 0.7, a: 0, fill, edge: C.ink, verts });
      }
    }
    if (this.debris.length > 48) this.debris.splice(0, this.debris.length - 48);
  }

  renderBanner() {
    const p = this.puzzle, el = $('banner');
    const t = TWIST_TEXT[p.twist];
    const text = [p.sunday ? 'Sunday big build: two towers, four throws' : '', typeof t === 'function' ? t(p) : ''].filter(Boolean).join('  \u00B7  ');
    const ch = this.opts.challenge;
    const msg = [this.opts.practice ? 'Practice run: no streak, no rank' : '', text, ch && !this.opts.practice && ch.number === p.number ? `A friend knocked down ${ch.score}% of this tower. Beat it?` : ''].filter(Boolean).join('  ·  ');
    el.textContent = msg; el.classList.toggle('hidden', !msg);
    this.wind = p.wind || 0;
  }

  // ---- aiming -----------------------------------------------------------------------
  obj() { return this.puzzle.objects[this.sel]; }
  thrownObjects() { return this.thrown.map((k) => this.puzzle.objects[k]); }
  startAim() {
    this.mode = 'aim'; this.gyTarget = this.gyAim; this.pull = null; this.plan = null; this.revealPaths = null;
    this.fx.list.length = 0; this.proj = null; this.snap = null;
    this.fitCam(false);
    if (this.used.has(this.sel)) this.sel = this.puzzle.objects.findIndex((_, k) => !this.used.has(k));
    this.showCard();
    this.renderTray();
    this.renderStars();
    $('sheet').classList.add('hidden'); $('power').classList.add('hidden'); $('tray').classList.remove('hidden');
    const h = $('hint'); h.textContent = 'Pull back, let go'; h.classList.remove('hidden', 'warn');
    $('card').style.opacity = 1;
  }
  /** Which materials this object can break in one hit today (a plain block, hit at the middle of the tower). */
  matsFor(o, compute = false) {
    this.matCache = this.matCache || new Map();
    if (!this.matCache.has(o.id) && compute) {
      const p = this.puzzle, cells = Math.max(...p.tower.blocks.map((b) => b.r0 + b.h));
      const E = typicalEnergy(o, p.distance, cells, { g: p.g, wind: p.wind });
      this.matCache.set(o.id, { 1: E >= p.hp[1], 2: E >= p.hp[2], 3: E >= p.hp[3] });
    }
    return this.matCache.get(o.id) || null;
  }
  /** The material chips need a few small simulations per object; do them one at a time after the first paint so nothing hitches. */
  warmMats() {
    this.puzzle.objects.forEach((o, k) => setTimeout(() => { this.matsFor(o, true); if (this.mode === 'aim' && this.obj() === o) this.showCard(); }, 250 + 120 * k));
  }
  showCard() {
    const o = this.obj(), c = describeCard(o);
    const m = this.matsFor(o);
    $('cardMats').innerHTML = m ? '<span class="matLab">Smashes</span>' + [[1, 'glass'], [2, 'wood'], [3, 'stone']].map(([t, n]) => `<span class="mat ${n} ${m[t] ? 'on' : 'off'}">${n}</span>`).join('') : '';
    $('cardName').textContent = c.name; $('cardStats').textContent = c.stats; $('cardSize').textContent = c.size;
    const ic = $('cardIcon'), g = ic.getContext('2d'); g.clearRect(0, 0, 112, 112); drawObject(g, o.id, 56, 56, 84);
  }
  renderTray() {
    const tray = $('tray'); tray.innerHTML = '';
    this.puzzle.objects.forEach((o, k) => {
      const b = document.createElement('button'); b.className = 'tile' + (this.used.has(k) ? ' spent' : k === this.sel ? ' sel' : '');
      b.setAttribute('aria-label', o.name);
      const c = document.createElement('canvas'); c.width = 96; c.height = 96; drawObject(c.getContext('2d'), o.id, 48, 48, 74);
      const bd = document.createElement('span'); bd.className = 'badge';
      const at = this.thrown.indexOf(k); bd.textContent = at >= 0 ? `+${pct(this.deltas[at] || 0)}%` : '';
      b.append(c, bd);
      b.onclick = () => this.select(k);
      tray.append(b);
    });
    tray.classList.toggle('hidden', this.mode !== 'aim');
  }
  select(k) {
    if (this.mode !== 'aim' || this.used.has(k) || k === this.sel) return;
    this.sel = k; this.pull = this.pull ? this.pull : null;
    sfx('pull', 0.3);
    this.showCard(); this.renderTray();
  }
  renderStars() {
    const n = this.puzzle.objects.length;
    $('stars').innerHTML = Array.from({ length: n }, (_, k) => starSvg(k < this.thrown.length ? 'off' : k === this.thrown.length && this.mode === 'aim' ? 'on now' : 'on')).join('');
  }

  bindInput() {
    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => {
      unlock();
      if (this.mode !== 'aim') return;
      cv.setPointerCapture(e.pointerId);
      this.drag = { x: e.clientX, y: e.clientY };
      $('hint').classList.add('hidden');
      e.preventDefault();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.drag || this.mode !== 'aim') return;
      const dx = this.drag.x - e.clientX, dy = e.clientY - this.drag.y;
      this.setPull((dx / this.R) * PULL_MAX, (dy / this.R) * PULL_MAX);
    });
    const up = (e) => {
      if (!this.drag) return;
      this.drag = null;
      if (this.mode !== 'aim') return;
      this.release();
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { this.drag = null; this.cancelPull(); });
    window.addEventListener('keydown', (e) => {
      if (!$('modal').classList.contains('hidden') || (e.target && e.target.closest && e.target.closest('button, input, select, textarea, a'))) return;
      if (this.mode !== 'aim') { if ((e.key === 'Enter' || e.key === ' ') && this.mode === 'reveal') this.next(); return; }
      const step = e.shiftKey ? 40 : 10;
      const q = this.pull || { px: 300, py: 300 };
      if (e.key === 'ArrowLeft') this.setPull(q.px - step, q.py);
      else if (e.key === 'ArrowRight') this.setPull(q.px + step, q.py);
      else if (e.key === 'ArrowUp') this.setPull(q.px, q.py + step);
      else if (e.key === 'ArrowDown') this.setPull(q.px, q.py - step);
      else if (e.key === 'Enter' || e.key === ' ') { unlock(); this.release(); } else return;
      $('hint').classList.add('hidden');
      e.preventDefault();
    });
    $('nextBtn').addEventListener('click', () => this.next());
  }

  setPull(px, py) {
    const q = quantizePull(px, py);
    const was = this.pull ? powerNumber(this.pull.px, this.pull.py) : 0;
    this.pull = q;
    const n = powerNumber(q.px, q.py);
    if (n !== was && n % 4 === 0) sfx('pull', n / 100);
  }
  cancelPull() { this.pull = null; $('power').classList.add('hidden'); if (this.mode === 'aim') $('hint').classList.remove('hidden'); }
  release() {
    if (!this.pull) return;
    const len = fsqrt(this.pull.px * this.pull.px + this.pull.py * this.pull.py);
    if (len < MIN_PULL) { this.cancelPull(); const h = $('hint'); h.textContent = 'Pull back a bit further'; h.classList.add('warn'); h.classList.remove('hidden'); return; }
    this.fire(this.pull.px, this.pull.py);
  }

  buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* not supported */ } }

  // ---- the throw --------------------------------------------------------------------
  fire(px, py) {
    const o = this.obj(), p = this.puzzle;
    this.shots.push([px, py, this.sel]);
    saveDay(this.key, { shots: this.shots, done: false, sig: this.sig }, this.ns);
    this.lastPull = { px, py }; this.launch = launchVelocity(px, py);
    this.snap = { px, py, t: 0 };
    const res = throwAt(this.tower, o, px, py, { g: p.g, wind: p.wind });
    this.res = res;
    this.towerBefore = this.tower;
    this.hist.push({ tower: this.tower, shot: [px, py, this.sel] });
    this.plan = buildPlan(res, this.towerBefore);
    this.sim = this.M ? new Collapse(this.M, {
      towerBefore: this.towerBefore, tower0: this.tower0, plan: this.plan, res, obj: o, rngSeed: `${this.key}|${this.i}`,
      dummies: this.dummies.filter((d) => d.host !== null).map((d) => ({ id: d.id, role: d.role, host: d.host, pose: d.state === 'stand' ? standPose(d.x, d.base, 0) : d.pose, face: d.face })),
    }) : null;
    this.slow = null; this.hitStop = 0; this.sq = null; this.thudAt = -9; this.breakAt = -9; this.oofs = 0;
    this.flyCam = { fit: this.fitView(), imp: this.impactView() };
    this.t = 0; this.mode = 'fly'; this.pull = null;
    this.fired = new Set();
    $('power').classList.add('hidden'); $('hint').classList.add('hidden'); $('card').style.opacity = 0.35; $('tray').classList.add('hidden');
    this.renderStars();
    sfx('launch');
  }

  // ---- animation loop ---------------------------------------------------------------
  tick(now) {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000)); this.last = now; this.time += dt;
    this.resize2();
    if (this.mode === 'fly') this.updateFly(dt);
    this.fx.update(dt);
    if (this.introT < 3) this.introT += dt;
    // camera
    const k = 1 - Math.exp(-dt * (this.mode === 'fly' ? 6.5 : 4.5));
    this.gy += (this.gyTarget - this.gy) * (1 - Math.exp(-dt * 6));
    this.cam.cx += (this.camTarget.cx - this.cam.cx) * k; this.cam.ppm += (this.camTarget.ppm - this.cam.ppm) * k;
    this.shake.amp *= Math.exp(-dt * 7);
    this.kick *= Math.exp(-dt * 5); this.flash *= Math.exp(-dt * 10);
    const p0 = performance.now();
    try { this.draw(); } catch (e) { if (!this.drawErr) { this.drawErr = e; console.error('draw failed', e && e.stack); } }   // one bad frame must never freeze the game
    const pm = performance.now() - p0 + (this.simMs || 0); this.perf.n++; this.perf.ms += pm; this.perf.worst = Math.max(this.perf.worst, pm);
    this.simMs = 0;
    requestAnimationFrame((n) => this.tick(n));
  }
  resize2() { if (this.cv.clientWidth !== this.W || this.cv.clientHeight !== this.H) { this.resize(); if (this.mode === 'aim') this.fitCam(true); } }

  /** How big a hit is, 0 (a ping-pong ball) to 1 (a piano). Drives shake, hit-stop and slow motion. */
  bigness(E) { return Math.max(0, Math.min(1, (Math.log10(1 + E) - 1.0) / 2.8)); }

  updateFly(dt) {
    const plan = this.plan, o = this.obj(), real = dt;
    // hit-stop freezes everything for a moment; slow motion eases back to full speed
    if (this.hitStop > 0) { this.hitStop -= dt; dt = 0; }
    else if (this.slow) {
      this.slow.left -= real;
      const k = Math.max(0, this.slow.left / this.slow.total);
      dt *= this.slow.min + (1 - this.slow.min) * (1 - k) * (1 - k);
      if (this.slow.left <= 0) this.slow = null;
    }
    this.t += dt;
    const t = this.t, g = this.puzzle.g || G;
    if (this.sim && dt > 0) { const s0 = performance.now(); this.sim.update(t); this.simMs = performance.now() - s0; for (const e of this.sim.drain()) this.simFx(e); }
    const pose = (this.sim && this.sim.projPose()) || projectileAt(plan, o, t, g);
    // little trail behind the flying object
    if (dt > 0 && t < (plan.tc ?? plan.flightEnd) && (this.trailT = (this.trailT || 0) + dt) > 0.04) {
      this.trailT = 0;
      this.fx.list.push({ kind: 'puff', x: pose.x, y: pose.y, vx: 0, vy: 0, g: 0, rot: 0, vr: 0, size: 2.6, life: 0.35, max: 0.35, drag: 0 });
    }
    const imp = plan.res.impact;
    if (!imp || t < imp.time) this.flyCamera(t, pose); else this.camTarget = this.flyCam.imp;
    // one-shot effects at the moment of each hit (breaks, falls and landings come from the sim)
    for (const it of plan.items) {
      if (t < it.at || this.fired.has(it)) continue;
      this.fired.add(it);
      const b = this.towerBefore.blocks[it.id];
      const wx = this.tower0.x0 + (it.k === 'fall' ? it.toC : b.c) * CELL, wy = (it.k === 'fall' ? it.to : b.r) * CELL;
      const bx = wx + (b.w * CELL) / 2, by = wy + (b.h * CELL) / 2;
      const mat = b.key || b.tier === 1 ? 'glass' : b.tier === 2 ? 'wood' : 'stone';
      if (it.k === 'hit') {
        sfx(mat); this.buzz(it.broken ? 14 : 6);
        this.materialFx(mat, bx, by, it.broken ? 1 : 0.5);
      } else if (!this.sim) {
        if (it.k === 'break') { sfx(mat); this.fx.chips(bx, by, chipColor(b), 7); this.fx.puff(bx, by, 2); }
        else if (it.k === 'fall') { this.shake.amp = Math.max(this.shake.amp, 2.5); sfx('rumble', 0.6); }
      }
    }
    if (imp && t >= imp.time && !this.impacted) {
      this.impacted = true;
      const big = this.bigness(imp.energy);
      this.fx.burst(imp.x, imp.y, 12 + 10 * big);
      this.fx.ring(imp.x, imp.y, 6 + 8 * big);
      this.fx.rays(imp.x, imp.y, 7 + 7 * big);
      this.fx.dust(imp.x, imp.y, 2 + Math.round(4 * big), 8 + 6 * big);
      this.shake.amp = Math.min(18, 3 + 15 * big); this.kick = 0.05 + 0.1 * big; this.flash = 0.12 + 0.35 * big;
      this.hitStop = 0.045 + 0.13 * big; this.buzz(25);
      const epic = big > 0.5 || (imp.keyHit && imp.broke > 0) || imp.broke >= 3;
      if (epic) { const m = 0.2 + 0.2 * (1 - big); this.slow = { left: 0.5 + 0.5 * big, total: 0.5 + 0.5 * big, min: m }; }
      const L = this.launch; this.sq = { t0: this.time, amp: 0.22 + 0.2 * big, ang: L ? Math.atan2(-L.vy, L.vx) : 0 };
      sfx(imp.broke > 0 ? 'thunk' : 'bonk', Math.min(1, 0.25 + big));
      if (big > 0.4) sfx('boom', big);
    }
    if (!imp && !this.landed && t >= plan.flightEnd - 0.04) {
      this.landed = true; this.fx.dust(plan.res.flight.landX, 0.2, 3, 8); sfx('bonk');
      this.sq = { t0: this.time, amp: 0.25, ang: Math.PI / 2 };
    }
    if (t >= plan.end) { this.impacted = false; this.landed = false; this.zoomed = false; this.endThrow(); }
  }

  /** Small material-specific burst: wood splinters, glass shards, stone chips, plus dust. */
  materialFx(mat, x, y, k = 1) {
    const f = this.fx;
    if (mat === 'wood') { f.splinters(x, y, Math.round(4 + 6 * k)); f.dust(x, y, 1 + Math.round(2 * k), 7); }
    else if (mat === 'glass') { f.shards(x, y, Math.round(5 + 8 * k)); f.glint(x, y, Math.round(2 + 4 * k)); }
    else { f.chips(x, y, C.stone, Math.round(3 + 5 * k)); f.dust(x, y, 3 + Math.round(4 * k), 12); this.shake.amp = Math.max(this.shake.amp, 3 * k); }
  }

  /** Events from the rigid-body sim: breaks, landings, bounces, flopping dummies. */
  simFx(e) {
    if (e.k === 'break') {
      const mat = e.key || e.tier === 1 ? 'glass' : e.tier === 2 ? 'wood' : 'stone';
      if (this.time - this.breakAt > 0.05) { sfx(mat, 1); this.breakAt = this.time; }
      this.materialFx(mat, e.x, e.y, 1);
      if (e.key) { this.fx.stars(e.x, e.y, 9); sfx('star'); this.fx.ring(e.x, e.y, 16); }
      this.shake.amp = Math.max(this.shake.amp, 2 + 3 * Math.min(1, e.power));
    } else if (e.k === 'release') {
      this.fx.dust(e.x, e.y - 0.5, 2, 8);
      if (this.time - (this.rumbleAt || -9) > 0.35) { sfx('rumble', 0.5); this.rumbleAt = this.time; }
      this.shake.amp = Math.max(this.shake.amp, 2.2);
    } else if (e.k === 'thud') {
      if (e.kind === 'proj') {
        if (this.time - this.thudAt > 0.07) { sfx(e.speed > 6 ? 'bounce' : 'bonk', Math.min(1, e.speed / 14)); this.thudAt = this.time; }
        this.fx.dust(e.x, Math.max(0.2, e.y), e.speed > 7 ? 2 : 1, 6);
        this.sq = { t0: this.time, amp: Math.min(0.4, 0.12 + e.speed / 40), ang: Math.PI / 2 };
      } else if (e.kind === 'dummy') {
        if (this.time - this.thudAt > 0.12) { sfx('squeak', Math.min(1, e.speed / 10)); this.thudAt = this.time; }
      } else {
        const mat = e.key || e.tier === 1 ? 'glass' : e.tier === 2 ? 'wood' : 'stone';
        const vol = Math.min(1, e.speed / 11);
        if (this.time - this.thudAt > 0.05) { sfx(e.speed > 4.5 ? mat : 'thud', 0.3 + vol); this.thudAt = this.time; }
        this.fx.dust(e.x, Math.max(0.15, e.y), 1 + Math.round(vol * 3), 7 + vol * 5);
        if (e.tier === 1 && e.speed > 4) this.fx.shards(e.x, e.y, 3);
        this.shake.amp = Math.max(this.shake.amp, Math.min(7, 1 + e.speed * 0.45));
        if (this.time - (this.rumbleAt || -9) > 0.2 && vol > 0.5) { this.rumbleAt = this.time; }
      }
    } else if (e.k === 'creak') {
      if (this.time - (this.creakAt || -9) > 0.3) { sfx('creak', 0.6); this.creakAt = this.time; }
      this.fx.dust(e.x, e.y, 1, 5, 1.2);
    } else if (e.k === 'dummy') {
      if (e.role === 'foreman') {
        this.fx.text(e.x, e.y + 1.6, ['My hat!', 'Whaaa!', 'Union break!', 'Not the hat!'][Math.floor(this.rnd() * 4)], 15, '#FFFFFF'); this.fx.stars(e.x, e.y + 0.8, 5); this.oofs = 9;
      } else if (this.oofs < 1 || e.power > 0.8) {
        this.oofs++;
        this.fx.text(e.x, e.y + 1.4, ['oof!', 'whoa!', 'boing!', 'eep!'][Math.floor(this.rnd() * 4)], 15, '#FFFFFF');
        this.fx.stars(e.x, e.y + 0.8, 3);
      }
      sfx('squeak', 0.7 + 0.3 * Math.min(1, e.power));
    }
  }

  summaryOf(res, obj) {
    const imp = res.impact;
    return { delta: res.delta, hit: !!imp, broke: imp ? imp.broke : 0, key: imp ? imp.keyHit : false };
  }

  endThrow() {
    const res = this.res, o = this.obj(), p = this.puzzle;
    this.tower = res.tower;
    if (this.sim) {
      const left = this.sim.leave();
      this.debris.push(...left.debris); if (this.debris.length > 48) this.debris.splice(0, this.debris.length - 48);
      this.restProj = left.proj;
      for (const l of left.dummies) {
        const d = this.dummies[l.id], sup = supportAt(res.tower, l.pose.torso.x, poseBottom(l.pose), 0.3);
        d.pose = l.pose; d.state = 'lying'; d.face = 'dizzy'; d.host = sup.id; d.base = sup.y; d.x = l.pose.torso.x;
      }
      this.sim.destroy(); this.sim = null;
    } else this.restProj = null;
    this.slow = null; this.hitStop = 0;
    this.reactForeman(res);
    this.deltas.push(res.delta); this.summaries.push(this.summaryOf(res, o));
    this.used.add(this.sel); this.thrown.push(this.sel);
    this.mode = 'reveal'; this.gyTarget = this.gyReveal; this.camTarget = this.revealView();
    this.buildReveal(res, o);
    this.fx.text(this.tower0.x0 + (this.tower0.width * CELL) / 2, this.towerH * CELL * 0.15, res.delta > 0.005 ? `+${pct(res.delta)}%` : 'no damage', 30, res.delta > 0.005 ? '#FFFFFF' : '#FFE3E3');
    sfx(res.delta > 0.15 ? 'win' : res.delta > 0.005 ? 'star' : 'miss');
    const last = this.thrown.length >= p.objects.length;
    $('nextBtn').textContent = last ? 'See your results' : 'Next throw';
    $('sheet').classList.remove('hidden');
    this.renderStars();
  }

  /** The smug foreman reacts to a throw that did not get him: a miss, or a near miss. */
  reactForeman(res) {
    const fm = this.dummies.find((d) => d.role === 'foreman');
    this.react = null;
    if (!fm || fm.state !== 'stand') return;
    const imp = res.impact;
    let near = Infinity;
    for (const q of res.flight.path) { if (imp && q.t > imp.time) break; near = Math.min(near, Math.hypot(q.x - fm.x, q.y - (fm.base + 1.3))); }
    if (!imp || res.delta < 0.005) {
      const close = near < 3.4;
      this.react = { face: close ? 'cheeky' : 'grin', until: this.time + 3 };
      this.fx.text(fm.x, fm.base + 3.3, close ? 'Ha! Too close!' : ['Nice try!', 'Is that all?', 'Not today!'][Math.floor(this.rnd() * 3)], 15, '#FFFFFF');
      sfx('squeak', 0.5);
    }
  }

  buildReveal(res, o) {
    const p = this.puzzle, { px, py } = this.lastPull, imp = res.impact, g = p.g || G;
    const air = noAirArc(px, py, 140, g);
    const real = imp ? res.flight.path.filter((q) => q.t <= imp.time).concat([{ x: imp.x, y: imp.y }]) : res.flight.path;
    this.revealPaths = { real, ghost: air.path, hit: imp ? { x: imp.x, y: imp.y } : null };
    const lines = [];
    const kmh = (v) => Math.round(v * 3.6);
    const launch = launchVelocity(px, py); const v0 = fsqrt(launch.vx * launch.vx + launch.vy * launch.vy);
    let big, small;
    const total = fractionDown(res.tower);
    if (imp) {
      big = res.delta > 0.005 ? `${pct(res.delta)}% down` : 'Bounced off';
      small = this.thrown.length > 1 ? `Tower is now ${pct(total)}% down` : `Nice. ${p.objects.length - 1} more throws.`;
      if (imp.keyHit && imp.broke > 0) lines.push(['★', 'You hit the gold block!']);
      lines.push([imp.broke > 0 ? '•' : '•', imp.broke > 0 ? `Smashed ${imp.broke} block${imp.broke > 1 ? 's' : ''} at ${kmh(imp.speed)} km/h` : `Hit a ${TIER_NAME[imp.tier]} block at ${kmh(imp.speed)} km/h and only cracked it`]);
      const cut = air.path.find((q, k, arr) => k > 0 && arr[k - 1].x <= imp.x && q.x >= imp.x);
      if (cut) {
        const a = air.path[air.path.indexOf(cut) - 1];
        const yAir = a.y + ((imp.x - a.x) / (cut.x - a.x || 1)) * (cut.y - a.y);
        const drop = yAir - imp.y;
        lines.push(['•', `Air slowed it from ${kmh(v0)} to ${kmh(imp.speed)} km/h${drop > 0.3 ? ` and pulled it ${drop.toFixed(1)} m below the dashed arc` : ''}`]);
      }
      if (imp.broke === 0) lines.push(['tip', 'Heavier or faster throws break tougher blocks.']);
    } else {
      const x0 = this.tower0.x0, lx = res.flight.landX;
      const cost = air.landX - lx;
      big = 'Missed';
      small = lx < x0 ? `Landed ${(x0 - lx).toFixed(1)} m short of the tower` : 'Sailed over the top';
      lines.push(['•', `Air cost you ${cost.toFixed(1)} m of range`]);
      const mid = (this.towerH * CELL) * 0.5;
      const m = pullToCross(o, px, py, x0 + 0.3, mid, { g: p.g, wind: p.wind });
      if (m) lines.push(['tip', `At that angle, power ${powerNumber(m.px, m.py)} would have hit the middle of the tower (you used ${powerNumber(px, py)}).`]);
    }
    $('sheetBig').innerHTML = `${big}<small>${small}</small>`;
    $('sheetLines').innerHTML = lines.map(([m, t]) => (m === 'tip' ? `<div class="tip">${t}</div>` : `<div><b>${m}</b><span>${t}</span></div>`)).join('');
  }

  next() {
    if (this.mode !== 'reveal') return;
    unlock();
    if (this.revealPaths) this.ghost = { real: this.revealPaths.real, hit: this.revealPaths.hit };
    this.i++;
    $('sheet').classList.add('hidden');
    if (this.thrown.length >= this.puzzle.objects.length) { this.finish(false); return; }
    this.startAim();
  }

  finish(restored) {
    this.mode = 'done';
    $('hint').classList.add('hidden'); $('power').classList.add('hidden'); $('sheet').classList.add('hidden');
    this.renderStars();
    showResults(this, restored);
  }

  // ---- drawing ----------------------------------------------------------------------
  /** Squash (k < 0) and stretch (k > 0) for the object on screen right now. */
  squashNow() {
    let k = 0, ang = 0;
    if (this.sq) {
      const dt = this.time - this.sq.t0;
      if (dt > 0.6) this.sq = null;
      else { k = -this.sq.amp * Math.exp(-dt * 13) * Math.cos(dt * 22); ang = this.sq.ang; }
    }
    if (this.mode === 'fly' && this.launch && this.t < 0.32) {
      const sk = 0.55 * Math.exp(-this.t * 11);
      if (sk > Math.abs(k)) { k = sk; ang = Math.atan2(-this.launch.vy, this.launch.vx); }
    }
    return Math.abs(k) > 0.01 ? { k, ang } : null;
  }

  dummyDraw(introDY) {
    const out = [], views = this.sim ? this.sim.dummyViews() : [];
    const power = this.pull ? powerNumber(this.pull.px, this.pull.py) : 0;
    const teeter = this.sim ? this.sim.teeteringHosts(this.t) : null;
    const pj = this.mode === 'fly' && this.sim ? this.sim.projPose() : null;
    for (const d of this.dummies) {
      const v = views[d.id], fore = d.role === 'foreman';
      if (v && v.active) { out.push({ pose: v.pose, face: 'dizzy', role: d.role }); continue; }
      if (d.state === 'stand') {
        const dy = introDY ? introDY.get(d.host) : 0;
        if (dy === undefined) continue;                       // host block not on screen yet
        const scared = (this.mode === 'fly' && !this.impacted && !pj) || (teeter && teeter.has(d.host));
        const worry = scared || (!fore && this.mode === 'aim' && power > 35);
        const react = fore && this.react && this.time < this.react.until ? this.react : null;
        const wave = this.mode === 'aim' && !this.pull && !react && (this.time + d.phase * 2) % 8 < 1.1;
        const hop = react ? 0.22 * Math.abs(Math.sin((this.react.until - this.time) * 7)) * Math.min(1, (this.react.until - this.time) * 1.5) : 0;
        const face = worry ? 'worried' : react ? react.face : fore ? 'smug' : 'happy';
        out.push({ pose: standPose(d.x, d.base + dy * CELL + hop, this.time, { phase: d.phase, wave, worry: worry && !fore }), face, role: d.role });
      } else out.push({ pose: d.pose, face: 'dizzy', role: d.role });
    }
    return out;
  }

  draw() {
    const ctx = this.ctx, { W, H, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cam = this.kick > 0.002 ? { cx: this.cam.cx, ppm: this.cam.ppm * (1 + this.kick) } : this.cam;
    const S = { W, H, gy: this.gy, cam, bracket: this.mode === 'aim', tower0: this.tower0, time: this.time, wind: this.wind, particles: this.fx.list, flash: this.flash };
    S.shake = this.shake.amp > 0.15 ? { x: (this.rnd() - 0.5) * this.shake.amp, y: (this.rnd() - 0.5) * this.shake.amp } : null;
    // blocks
    const flying = this.mode === 'fly' && this.plan;
    if (flying) { S.blocks = blockViews(this.towerBefore, this.plan, this.t); if (this.sim) this.sim.applyViews(S.blocks, this.t); }
    else S.blocks = blockViews(this.tower, null, 0);
    const introDY = new Map();
    if (this.introT < 2.2) {
      // blocks drop in from the sky, bottom rows first
      for (const v of S.blocks) {
        const delay = v.y * 0.11 + v.x * 0.03, k = Math.max(0, Math.min(1, (this.introT - delay) / 0.32));
        const dy = (1 - k) * (1 - k) * 14;
        v.y += dy; v.alpha = k > 0 ? 1 : 0;
        if (k > 0) introDY.set(v.id, dy);
      }
    } else for (const v of S.blocks) introDY.set(v.id, 0);
    S.dummies = this.dummyDraw(introDY);
    S.debris = this.debris;
    if (this.mode === 'aim' && this.ghost) S.ghost = this.ghost;
    if (this.sim) S.chunks = this.sim.chunkViews();
    // projectile and aim
    const o = this.mode === 'done' ? null : this.obj();
    const size = o ? spriteMetres(o) : 0;
    const ppm = cam.ppm;
    if (flying) {
      const p = (this.sim && this.sim.projPose()) || projectileAt(this.plan, o, this.t, this.puzzle.g || G);
      S.proj = { id: o.id, x: p.x, y: p.y, rot: p.rot, size, show: true, sq: this.squashNow() };
      if (this.snap && this.t < 0.7) {
        // the band snaps forward and wobbles; the object leaves the pouch at the end of the first snap
        const a = anchorScreen({ W, gy: this.gy, cam, });
        const px0 = a.x - (this.snap.px / PULL_MAX) * this.R, py0 = a.y + (this.snap.py / PULL_MAX) * this.R;
        const w = 40, zeta = 0.17, tt = this.t, env = Math.exp(-zeta * w * tt) * Math.cos(w * Math.sqrt(1 - zeta * zeta) * tt);
        S.aim = { obj: tt < 0.05 ? o : null, pouch: { x: a.x + (px0 - a.x) * env, y: a.y + (py0 - a.y) * env }, size, visible: tt < 0.05, arc: null, empty: true, stretch: 0 };
        if (tt < 0.05) S.proj.show = false;
      } else if (this.snap) this.snap = null;
    } else if (this.mode === 'reveal' && this.plan) {
      const p = this.restProj || projectileAt(this.plan, o, this.plan.end, this.puzzle.g || G);
      S.proj = { id: o.id, x: p.x, y: p.y, rot: p.rot || 0, size, show: true, sq: null };
      S.reveal = this.revealPaths;
    }
    if (this.mode === 'aim' && o) {
      const a = anchorScreen({ W, gy: this.gy, cam });
      const q = this.pull;
      const pouch = q ? { x: a.x - (q.px / PULL_MAX) * this.R, y: a.y + (q.py / PULL_MAX) * this.R } : { x: a.x, y: a.y };
      const str = q ? Math.min(1, powerNumber(q.px, q.py) / 100) : 0;
      const pang = q ? Math.atan2(a.y - pouch.y, a.x - pouch.x) : 0;
      S.aim = { obj: o, pouch, size, visible: true, arc: q && powerNumber(q.px, q.py) > 3 ? noAirArc(q.px, q.py, 90, this.puzzle.g || G).path : null, stretch: str, sq: str > 0.02 ? { k: -0.14 * str, ang: pang } : null };
      const pw = $('power');
      if (q && powerNumber(q.px, q.py) > 0) {
        pw.classList.remove('hidden'); $('powerNum').textContent = powerNumber(q.px, q.py);
        pw.style.left = `${Math.max(70, a.x)}px`; pw.style.top = `${a.y - 0.9 * cam.ppm - 30}px`;
      } else pw.classList.add('hidden');
    } else if (this.mode === 'reveal') {
      S.aim = { obj: null, pouch: null, size, visible: false, arc: null };
    }
    const hint = $('hint'); if (!hint.classList.contains('hidden')) hint.style.top = `${Math.min(this.H - 70, this.gyAim + 92)}px`;
    drawScene(ctx, S);
  }
}
