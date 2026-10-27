// The game: one day, three throws. Input, state machine, animation loop, overlays.
import { C } from './palette.js';
import { drawScene, anchorScreen, TAU } from './render.js';
import { drawObject } from './sprites.js';
import { quantizePull, powerNumber, noAirArc, ANCHOR_H, G, MIN_PULL, V_MAX, PULL_MAX, launchVelocity, fsqrt } from './physics.js';
import { throwAt, fractionDown, CELL, alive } from './tower.js';
import { pullToCross } from './calibrate.js';
import { buildPlan, blockViews, projectileAt, makeParticles, chipColor } from './anim.js';
import { makeRng, hash32, dragClass, TWIST_TEXT, puzzleSig } from './daily.js';
import { sfx, unlock, setMuted, isMuted } from './audio.js';
import { loadDay, saveDay, quarantine } from './store.js';
import { validateShots } from './verify.js';
import { showResults } from './results.js';
import { describeCard } from './card.js';

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
    this.R = 110;
    this.resize(); this.fitCam(true);
    window.addEventListener('resize', () => { this.resize(); if (this.mode === 'aim') this.fitCam(true); });
    this.bindInput();
    this.restore();
    this.introT = this.thrown.length === 0 && this.mode === 'aim' ? 0 : 9;
    setMuted(this.loadMute());
    this.bindMute();
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
  impactView() {
    const T = this.tower0;
    const tw = T.width * CELL;
    const ppm = Math.min(this.W / (tw + 9), (Math.min(this.gyAim, this.gyReveal) - (this.side ? 70 : 130)) / (this.towerH * CELL + 2), 70);
    return { cx: T.x0 + tw / 2 - 1.4 + (this.side ? (0.19 * this.W) / ppm : 0), ppm };
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
        this.deltas.push(res.delta); this.shots.push([px, py, idx]); this.summaries.push(this.summaryOf(res, this.puzzle.objects[idx]));
        this.used.add(idx); this.thrown.push(idx);
        this.tower = res.tower; this.i++;
      }
      if (this.thrown.length >= this.puzzle.objects.length || saved.done) { this.finish(true); return; }
    }
    this.startAim();
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
    this.fx.list.length = 0; this.proj = null;
    this.fitCam(false);
    if (this.used.has(this.sel)) this.sel = this.puzzle.objects.findIndex((_, k) => !this.used.has(k));
    this.showCard();
    this.renderTray();
    this.renderStars();
    $('sheet').classList.add('hidden'); $('power').classList.add('hidden'); $('tray').classList.remove('hidden');
    const h = $('hint'); h.textContent = 'Pull back, let go'; h.classList.remove('hidden', 'warn');
    $('card').style.opacity = 1;
  }
  showCard() {
    const o = this.obj(), c = describeCard(o);
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
    this.lastPull = { px, py };
    this.snap = { px, py, t: 0 };
    const res = throwAt(this.tower, o, px, py, { g: p.g, wind: p.wind });
    this.res = res;
    this.towerBefore = this.tower;
    this.plan = buildPlan(res, this.towerBefore);
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
    const k = 1 - Math.exp(-dt * 5);
    this.gy += (this.gyTarget - this.gy) * (1 - Math.exp(-dt * 6));
    this.cam.cx += (this.camTarget.cx - this.cam.cx) * k; this.cam.ppm += (this.camTarget.ppm - this.cam.ppm) * k;
    this.shake.amp *= Math.exp(-dt * 7);
    this.draw();
    requestAnimationFrame((n) => this.tick(n));
  }
  resize2() { if (this.cv.clientWidth !== this.W || this.cv.clientHeight !== this.H) { this.resize(); if (this.mode === 'aim') this.fitCam(true); } }

  updateFly(dt) {
    const plan = this.plan, o = this.obj();
    if (this.hitStop > 0) { this.hitStop -= dt; dt = 0; }
    this.t += dt;
    const t = this.t;
    // little trail behind the flying object
    if (dt > 0 && t < (plan.tc ?? plan.flightEnd) && (this.trailT = (this.trailT || 0) + dt) > 0.045) {
      this.trailT = 0;
      const pp = projectileAt(plan, o, t, this.puzzle.g || G);
      this.fx.list.push({ kind: 'puff', x: pp.x, y: pp.y, vx: 0, vy: 0, g: 0, rot: 0, vr: 0, size: 2.6, life: 0.35, max: 0.35 });
    }
    const imp = plan.res.impact;
    if (imp && t >= imp.time - 0.5 && !this.zoomed) { this.zoomed = true; this.camTarget = this.impactView(); }
    // trigger one-shot effects
    const ppm = this.cam.ppm;
    for (const it of plan.items) {
      if (t < it.at || this.fired.has(it)) continue;
      this.fired.add(it);
      const b = this.towerBefore.blocks[it.id];
      const wx = this.tower0.x0 + (it.k === 'fall' ? it.toC : b.c) * CELL, wy = (it.k === 'fall' ? it.to : b.r) * CELL;
      const bx = wx + (b.w * CELL) / 2, by = wy + (b.h * CELL) / 2;
      const col = chipColor(b);
      if (it.k === 'hit') {
        sfx(b.key || b.tier === 1 ? 'glass' : b.tier === 2 ? 'wood' : 'stone');
        this.buzz(it.broken ? 14 : 6);
        this.fx.chips(bx, by, col, it.broken ? 9 : 3);
        if (it.broken) { this.fx.puff(bx, by, 2); if (b.key) { this.fx.stars(bx, by, 8); sfx('star'); } }
      } else if (it.k === 'break') {
        sfx(b.key || b.tier === 1 ? 'glass' : b.tier === 2 ? 'wood' : 'stone'); this.fx.chips(bx, by, col, 7); this.fx.puff(bx, by, 2);
        if (b.key) { this.fx.stars(bx, by, 8); sfx('star'); }
      } else if (it.k === 'fall') {
        this.shake.amp = Math.max(this.shake.amp, 2.5); sfx('rumble', 0.6);
      }
    }
    if (imp && t >= imp.time && !this.impacted) {
      this.impacted = true;
      this.fx.burst(imp.x, imp.y, 24);
      this.fx.puff(imp.x, imp.y, 3);
      this.shake.amp = Math.min(14, 3 + Math.log10(1 + imp.energy) * 2.6);
      this.hitStop = 0.07; this.buzz(25);
      sfx(imp.broke > 0 ? 'thunk' : 'bonk', Math.min(1, Math.log10(1 + imp.energy) / 4));
    }
    if (!imp && !this.landed && t >= plan.flightEnd) { this.landed = true; this.fx.puff(plan.res.flight.landX, 0.2, 3); sfx('bonk'); }
    if (t >= plan.end) { this.impacted = false; this.landed = false; this.zoomed = false; this.endThrow(); }
  }

  summaryOf(res, obj) {
    const imp = res.impact;
    return { delta: res.delta, hit: !!imp, broke: imp ? imp.broke : 0, key: imp ? imp.keyHit : false };
  }

  endThrow() {
    const res = this.res, o = this.obj(), p = this.puzzle;
    this.tower = res.tower;
    this.deltas.push(res.delta); this.summaries.push(this.summaryOf(res, o));
    this.used.add(this.sel); this.thrown.push(this.sel);
    this.mode = 'reveal'; this.gyTarget = this.gyReveal;
    this.buildReveal(res, o);
    this.fx.text(this.tower0.x0 + (this.tower0.width * CELL) / 2, this.towerH * CELL * 0.15, res.delta > 0.005 ? `+${pct(res.delta)}%` : 'no damage', 30, res.delta > 0.005 ? '#FFFFFF' : '#FFE3E3');
    sfx(res.delta > 0.15 ? 'win' : res.delta > 0.005 ? 'star' : 'miss');
    const last = this.thrown.length >= p.objects.length;
    $('nextBtn').textContent = last ? 'See your results' : 'Next throw';
    $('sheet').classList.remove('hidden');
    this.renderStars();
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
  draw() {
    const ctx = this.ctx, { W, H, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S = { W, H, gy: this.gy, cam: this.cam, bracket: this.mode === 'aim', tower0: this.tower0, time: this.time, wind: this.wind, particles: this.fx.list };
    S.shake = this.shake.amp > 0.15 ? { x: (this.rnd() - 0.5) * this.shake.amp, y: (this.rnd() - 0.5) * this.shake.amp } : null;
    // blocks
    if (this.mode === 'fly' && this.plan) S.blocks = blockViews(this.towerBefore, this.plan, this.t);
    else S.blocks = blockViews(this.tower, null, 0);
    if (this.introT < 2.2) {
      // blocks drop in from the sky, bottom rows first
      for (const v of S.blocks) {
        const delay = v.y * 0.11 + v.x * 0.03, k = Math.max(0, Math.min(1, (this.introT - delay) / 0.32));
        v.y += (1 - k) * (1 - k) * 14; v.alpha = k > 0 ? 1 : 0;
      }
    }
    // projectile and aim
    const o = this.mode === 'done' ? null : this.obj();
    const size = o ? Math.max(20, Math.min(44, o.size * 12 * 1.0 + 12)) : 0;
    if (this.mode === 'fly' && this.plan) {
      const p = projectileAt(this.plan, o, this.t, this.puzzle.g || G);
      S.proj = { id: o.id, x: p.x, y: p.y, rot: p.rot, size, show: true };
      if (this.snap && this.t < 0.18) {
        // the band snaps forward; the object leaves the pouch at the end of the snap
        const a = anchorScreen({ W, gy: this.gy, cam: this.cam });
        const k = Math.min(1, this.t / 0.1), e = 1 - (1 - k) * (1 - k);
        const px0 = a.x - (this.snap.px / PULL_MAX) * this.R, py0 = a.y + (this.snap.py / PULL_MAX) * this.R;
        S.aim = { obj: this.t < 0.06 ? o : null, pouch: { x: px0 + (a.x - px0) * e, y: py0 + (a.y - py0) * e }, size, visible: this.t < 0.06, arc: null };
        if (this.t < 0.06) S.proj.show = false;
      } else if (this.snap) this.snap = null;
    } else if (this.mode === 'reveal' && this.plan) {
      const p = projectileAt(this.plan, o, this.plan.end, this.puzzle.g || G);
      S.proj = { id: o.id, x: p.x, y: p.y, rot: 0, size, show: true };
      S.reveal = this.revealPaths;
    }
    if (this.mode === 'aim' && o) {
      const a = anchorScreen({ W, gy: this.gy, cam: this.cam });
      const q = this.pull;
      const pouch = q ? { x: a.x - (q.px / PULL_MAX) * this.R, y: a.y + (q.py / PULL_MAX) * this.R } : { x: a.x, y: a.y };
      S.aim = { obj: o, pouch, size, visible: true, arc: q && powerNumber(q.px, q.py) > 3 ? noAirArc(q.px, q.py, 90, this.puzzle.g || G).path : null };
      const pw = $('power');
      if (q && powerNumber(q.px, q.py) > 0) {
        pw.classList.remove('hidden'); $('powerNum').textContent = powerNumber(q.px, q.py);
        pw.style.left = `${Math.max(70, a.x)}px`; pw.style.top = `${a.y - 0.9 * this.cam.ppm - 30}px`;
      } else pw.classList.add('hidden');
    } else if (this.mode === 'reveal') {
      S.aim = { obj: null, pouch: null, size, visible: false, arc: null };
    }
    const hint = $('hint'); if (!hint.classList.contains('hidden')) hint.style.top = `${Math.min(this.H - 70, this.gyAim + 92)}px`;
    drawScene(ctx, S);
  }
}
