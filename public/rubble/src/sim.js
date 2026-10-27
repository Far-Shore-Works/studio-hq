// Cosmetic rigid-body animation for ONE throw, on top of matter.js (vendor/matter.min.js).
//
// The scoring arithmetic in tower.js has already decided which blocks break, which fall and
// where everything ends up. This file only makes that look physical: blocks tumble, spin,
// bounce and settle; broken blocks burst into chunks; the thrown object bounces and rolls;
// little dummies flop. NOTHING here is ever read back into a score. At the end of the throw
// every block is eased onto the exact cell the arithmetic chose, so the next throw starts from
// the arithmetic tower, never from where the sim happened to leave things.
import { CELL } from './tower.js';
import { makeRng, hash32 } from './daily.js';
import { buildRagdoll, ragdollPose, poseBottom, supportAt, LIMITS } from './dummy.js';

export const SIM_G = 22;            // toy gravity in m/s^2 (snappier than 9.8)
export const S = 64;                // matter units per metre
export const CAP_CHUNKS = 72;       // hard cap on live chunks
export const BLEND = 0.5;           // seconds at the end spent easing blocks onto the arithmetic cells
const CAT = { ground: 1, block: 2, proj: 4, chunk: 8, dummy: 16 };
const DENSITY = { 1: 0.0007, 2: 0.0011, 3: 0.0020 };         // glass, wood, stone
const REST = { 1: 0.12, 2: 0.18, 3: 0.08 };
const BOX_SPRITES = new Set(['piano', 'fridge', 'anvil', 'block', 'pillow']);
const BOUNCE = { pingpong: 0.82, basketball: 0.74, tennis: 0.7, golf: 0.66, volleyball: 0.66, soccer: 0.6, tire: 0.5, bowling: 0.16, paperball: 0.12, pillow: 0.05, piano: 0.12, fridge: 0.1, anvil: 0.05, block: 0.1 };
const ASPECT = { piano: 1.35, fridge: 0.5, anvil: 1.7, tire: 1, block: 2, pillow: 1.3 };

const mpsToStep = (v) => (v * S) / 60;             // m/s -> matter px per 1/60 s step
const stepToMps = (v) => (v * 60) / S;
const normAngle = (a) => a - Math.round(a / Math.PI) * Math.PI;   // a rectangle looks the same turned half a circle

/** World size of the thrown object's sprite in metres (bigger side), shared with the renderer. */
export const spriteMetres = (obj) => Math.max(20, Math.min(44, obj.size * 12 + 12)) / 12;

export function projectileSpec(obj) {
  const sw = spriteMetres(obj);
  const a = ASPECT[obj.id] || 1;
  const w = a >= 1 ? sw : sw * a, h = a >= 1 ? sw / a : sw;
  const box = BOX_SPRITES.has(obj.id);
  // The body is a bit smaller than the picture so it does not snag on blocks the arithmetic let it pass.
  const k = box ? 0.78 : 0.6;
  const mass = 0.3 + 2.2 * Math.log10(1 + obj.mass);            // relative to a 1-cell block of about 10
  return { box, w: w * k, h: h * k, r: (Math.min(w, h) / 2) * (box ? 0.8 : k), sprite: sw, restitution: BOUNCE[obj.id] ?? 0.4, mass: mass * 10 };
}

const matColor = (b) => (b.key ? { fill: '#FFD23F', edge: '#D99A00', kind: 'gold' } : b.tier === 1 ? { fill: '#BDE9FF', edge: '#4E9BD1', kind: 'glass' } : b.tier === 2 ? { fill: '#EDBE72', edge: '#A46B2C', kind: 'wood' } : { fill: '#B4BECB', edge: '#75849A', kind: 'stone' });

export class Collapse {
  /**
   * M: the Matter library. o: { towerBefore, tower0, plan, res, obj, rngSeed, dummies, g }
   * dummies: [{ id, host, pose, face }] standing or lying figures that may get knocked.
   */
  constructor(M, o) {
    this.M = M; this.o = o; this.plan = o.plan; this.res = o.res; this.obj = o.obj;
    this.x0 = o.tower0.x0;
    this.rnd = makeRng(hash32(String(o.rngSeed || 'sim')));
    this.t = 0; this.frozen = false; this.over = false;
    this.events = []; this.chunks = []; this.bodies = new Map(); this.removed = new Set();
    this.wobble = new Map(); this.cool = new Map(); this.sleepT = 0;
    const { Engine, Bodies, Body, Composite, Events } = M;
    const eng = this.eng = Engine.create({ enableSleeping: true, positionIterations: 8, velocityIterations: 6 });
    eng.gravity.x = 0; eng.gravity.y = 1; eng.gravity.scale = (SIM_G * S) / 1e6;
    this.world = eng.world;
    const gnd = Bodies.rectangle(60 * S, 5 * S, 400 * S, 10 * S, { friction: 0.9, restitution: 0.1, label: 'ground' });
    gnd.collisionFilter = { category: CAT.ground, mask: 0xffff, group: 0 };
    Body.setStatic(gnd, true); gnd.plugin = { kind: 'ground' };
    Composite.add(this.world, gnd);
    this.ground = gnd;

    // every block of the tower is a body; the ones the arithmetic lets fall are released later
    this.fallIds = new Set(); this.lastFall = new Map();
    for (const it of this.plan.items) if (it.k === 'fall') { this.fallIds.add(it.id); this.lastFall.set(it.id, it); }
    this.final = new Map(o.res.tower.blocks.map((b) => [b.id, b]));
    for (const b of o.towerBefore.blocks) {
      if (!b.alive) continue;
      const w = b.w * CELL, h = b.h * CELL;
      const cx = this.x0 + b.c * CELL + w / 2, cy = b.r * CELL + h / 2;
      const body = Bodies.rectangle(cx * S, -cy * S, w * S, h * S, {
        chamfer: { radius: 0.1 * CELL * S }, friction: 0.7, frictionStatic: 1.0, restitution: REST[b.tier] || 0.1,
        density: DENSITY[b.tier] * (b.key ? 1.6 : 1), slop: 0.5, frictionAir: 0.008,
      });
      body.collisionFilter = { category: CAT.block, mask: CAT.ground | CAT.block | CAT.proj | CAT.dummy, group: 0 };
      // arms-length rotational inertia keeps stacks from spinning like coins
      Body.setInertia(body, body.inertia * 2.4);
      Body.setStatic(body, true);
      body.plugin = { kind: 'block', id: b.id, tier: b.tier, key: b.key, w, h };
      this.bodies.set(b.id, { body, b, released: false, gone: false });
      Composite.add(this.world, body);
    }
    // dummies (cosmetic figures): bodies are created only when something knocks them
    this.dummies = (o.dummies || []).map((d) => ({ d, active: null, ...{ id: d.id } }));
    this.group = -1;

    const hit0 = o.res.impact, path = o.res.flight.path;
    const first = hit0 ? path.find((q) => q.t >= hit0.time) || path[path.length - 1] : null;
    const dl = first ? Math.hypot(first.vx, first.vy) || 1 : 1;
    this.hitDir = first ? { x: first.vx / dl, y: first.vy / dl } : { x: 1, y: 0 };
    // suspense: blocks that are about to go creak and teeter for a beat first
    this.teeter = new Map();
    for (const it of this.plan.items) if ((it.k === 'fall' || (it.k === 'break' && it.cause === 'tip')) && !this.teeter.has(it.id)) {
      const bvv = this.bodies.get(it.id);
      if (!bvv) continue;
      const side = it.k === 'fall' && it.toC !== it.fromC ? Math.sign(it.toC - it.fromC) : (bvv.body.position.x / S > this.x0 + (o.tower0.width * CELL) / 2 ? 1 : -1);
      this.teeter.set(it.id, { t0: Math.max(0, it.at - 0.46), t1: it.at, side, said: false });
    }
    this.schedule = [...this.plan.items].sort((a, b) => a.at - b.at);
    this.si = 0;
    this.stopT = this.plan.stopT ?? null;       // the object stops tunnelling here and becomes a body
    this.projBody = null; this.projSpec = projectileSpec(this.obj);
    this.sq = null;                              // squash cue for the renderer
    Events.on(eng, 'collisionStart', (e) => this.onCollide(e));
  }

  // ---- helpers ----------------------------------------------------------------------
  setV(body, vx, vy) { this.M.Body.setVelocity(body, { x: mpsToStep(vx), y: -mpsToStep(vy) }); }
  emit(ev) { this.events.push(ev); }
  drain() { const e = this.events; this.events = []; return e; }
  blockPose(b) { const p = b.body.position; return { x: p.x / S, y: -p.y / S, a: b.body.angle, vx: stepToMps(b.body.velocity.x), vy: -stepToMps(b.body.velocity.y) }; }

  onCollide(e) {
    for (const pair of e.pairs) {
      const A = pair.bodyA, B = pair.bodyB, pa = A.plugin || {}, pb = B.plugin || {};
      const rv = Math.hypot(stepToMps(A.velocity.x - B.velocity.x), stepToMps(A.velocity.y - B.velocity.y));
      if (rv < 1.6) continue;
      const kind = pa.kind === 'proj' || pb.kind === 'proj' ? 'proj' : pa.kind === 'dummy' || pb.kind === 'dummy' ? 'dummy' : 'block';
      const blk = pa.kind === 'block' ? pa : pb.kind === 'block' ? pb : null;
      if (kind === 'block' && !blk) continue;
      const key = (blk && blk.id) ?? kind;
      const last = this.cool.get(key) ?? -9;
      const dyingBody = blk && this.bodies.get(blk.id);
      if (dyingBody && dyingBody.dying && pair.bodyA.plugin.kind === 'ground' || dyingBody && dyingBody.dying && pair.bodyB.plugin.kind === 'ground') dyingBody.dying = Math.min(dyingBody.dying, this.t + 0.06);
      if (this.t - last < (kind === 'dummy' ? 0.25 : 0.12)) continue;
      this.cool.set(key, this.t);
      const sup = pair.collision.supports[0] || { x: (A.position.x + B.position.x) / 2, y: (A.position.y + B.position.y) / 2 };
      const onGround = pa.kind === 'ground' || pb.kind === 'ground';
      this.emit({ k: 'thud', kind, x: sup.x / S, y: -sup.y / S, speed: rv, tier: blk ? blk.tier : 0, key: blk ? blk.key : false, ground: onGround, id: kind === 'proj' ? null : blk && blk.id });
      if (kind === 'proj') this.sq = { t: this.t, amp: Math.min(0.42, rv / 28), nx: pair.collision.normal.x, ny: -pair.collision.normal.y };
    }
  }

  // ---- chunks (broken blocks burst) ------------------------------------------------------
  /** Break a block into pieces that look like its material: wood snaps into planks and splinters, stone into heavy boulders, glass into a spray of shards. */
  burst(bv, dir, power, extra = 1) {
    const { Bodies, Body, Composite } = this.M;
    const m = matColor(bv.b), kindM = m.kind;
    const w = bv.b.w * CELL, h = bv.b.h * CELL;
    const p = bv.body.position, cx = p.x / S, cy = -p.y / S, ang = bv.body.angle;
    const area = bv.b.w * bv.b.h;
    const specs = [];                 // { shape, size, speed, bounce, air }
    if (kindM === 'wood') {
      specs.push({ s: 'plank', len: w * 0.5, th: Math.min(h * 0.44, 0.7) }, { s: 'plank', len: w * 0.42, th: Math.min(h * 0.36, 0.6) });
      for (let i = 0; i < 4 + area; i++) specs.push({ s: 'splinter', len: 0.7 + this.rnd() * 0.8, th: 0.1 });
    } else if (kindM === 'stone') {
      const n = 3 + Math.min(3, area);
      for (let i = 0; i < n; i++) specs.push({ s: 'rock', r: 0.3 + this.rnd() * 0.3, sides: 5 + (i % 2) });
    } else if (kindM === 'glass') {
      for (let i = 0; i < 7 + area * 2; i++) specs.push({ s: 'shard', r: 0.12 + this.rnd() * 0.22 });
    } else {
      for (let i = 0; i < 5; i++) specs.push({ s: 'rock', r: 0.22 + this.rnd() * 0.2, sides: 5 });
    }
    for (const sp of specs) {
      if (this.chunks.length >= CAP_CHUNKS) this.dropChunk(this.chunks.shift());
      const lx = (this.rnd() - 0.5) * w * 0.8, ly = (this.rnd() - 0.5) * h * 0.8;
      const x = cx + lx * Math.cos(ang) - ly * Math.sin(ang), y = cy + lx * Math.sin(ang) + ly * Math.cos(ang);
      let body;
      if (sp.s === 'plank') body = Bodies.rectangle(x * S, -y * S, sp.len * S, sp.th * S, { chamfer: { radius: 2 } });
      else if (sp.s === 'splinter') body = Bodies.rectangle(x * S, -y * S, sp.len * S, sp.th * S, { chamfer: { radius: 1 } });
      else if (sp.s === 'rock') body = Bodies.polygon(x * S, -y * S, sp.sides, sp.r * S, { chamfer: { radius: 2 } });
      else body = Bodies.polygon(x * S, -y * S, 3, sp.r * S);
      body.collisionFilter = { category: CAT.chunk, mask: CAT.ground, group: 0 };
      body.friction = kindM === 'stone' ? 0.9 : 0.6;
      body.restitution = kindM === 'glass' ? 0.3 : kindM === 'stone' ? 0.1 : 0.28;
      body.frictionAir = kindM === 'glass' ? 0.03 : kindM === 'stone' ? 0.004 : 0.012;      // glass flutters, stone drops like a stone
      Body.setAngle(body, this.rnd() * 6.28);
      const spread = kindM === 'stone' ? 0.7 : kindM === 'glass' ? 1.3 : 1.0;
      const spd = (1.5 + this.rnd() * 5.5) * spread * Math.min(1.5, 0.5 + power);
      const a = Math.atan2(dir.y, dir.x) + (this.rnd() - 0.5) * 2.2;
      this.setV(body, Math.cos(a) * spd + (lx / w) * 3, Math.sin(a) * spd + 2 + this.rnd() * 3.5);
      Body.setAngularVelocity(body, (this.rnd() - 0.5) * (kindM === 'stone' ? 0.25 : 0.5));
      body.plugin = { kind: 'chunk' };
      Composite.add(this.world, body);
      this.chunks.push({ body, kind: kindM, shape: sp.s, fill: m.fill, edge: m.edge, born: this.t, id: bv.b.id });
    }
  }
  dropChunk(c) { if (c) this.M.Composite.remove(this.world, c.body); }

  // ---- the schedule: what the arithmetic says happens, and when --------------------------------
  apply(it) {
    const bv = this.bodies.get(it.id);
    if (!bv) return;
    const hit = this.res.impact;
    const dir = { ...this.hitDir };
    const power = hit ? Math.min(1.6, Math.log10(1 + hit.energy) / 3) : 0.5;
    if (it.k === 'hit') {
      this.kickDummies(it.id, dir, power * (it.broken ? 1.3 : 0.8));
      if (it.broken) this.remove(bv, dir, power);
      else this.wobble.set(it.id, { t0: this.t, amp: 0.06 * Math.min(1.3, power + 0.3), dir: dir.x >= 0 ? 1 : -1 });
    } else if (it.k === 'fall') {
      this.release(bv, it);
    } else if (it.k === 'break') {
      this.kickDummies(it.id, { x: 0, y: 1 }, 0.5);
      // a block that tips off its edge and has nowhere to land tumbles off the tower, then bursts when it hits the ground
      if (it.cause === 'tip' && !bv.released) this.tumble(bv, dir);
      else this.remove(bv, { x: dir.x * 0.4, y: 0.6 }, 0.55);
    } else if (it.k === 'dmg') {
      this.kickDummies(it.id, { x: 0, y: 1 }, 0.35);
      this.wobble.set(it.id, { t0: this.t, amp: 0.035, dir: it.id % 2 ? 1 : -1 });
    }
  }
  release(bv, it) {
    if (bv.gone) return;
    const { Body } = this.M;
    if (!bv.released) {
      bv.released = true; Body.setStatic(bv.body, false); this.M.Sleeping.set(bv.body, false);
      bv.body.sleepThreshold = 40;
      const dx = (it.toC - it.fromC) * CELL, rows = Math.max(0, it.from - it.to);
      // tipping blocks slide off their edge with a little spin; straight drops just wobble
      this.setV(bv.body, dx !== 0 ? Math.sign(dx) * (1.4 + Math.min(3.5, Math.abs(dx))) : (this.rnd() - 0.5) * 0.8, 0.3 + rows * 0.0);
      Body.setAngularVelocity(bv.body, dx !== 0 ? Math.sign(dx) * (0.05 + this.rnd() * 0.05) : (this.rnd() - 0.5) * 0.03);
      this.emit({ k: 'release', id: it.id, x: bv.body.position.x / S, y: -bv.body.position.y / S, tier: bv.b.tier, side: dx !== 0 });
    }
    this.kickDummies(it.id, { x: 0, y: 1 }, 0.4, true);
  }
  tumble(bv, dir) {
    const { Body } = this.M;
    bv.released = true; bv.dying = this.t + 1.0; Body.setStatic(bv.body, false); this.M.Sleeping.set(bv.body, false);
    const side = bv.body.position.x / S > this.x0 + (this.o.tower0.width * CELL) / 2 ? 1 : -1;
    this.setV(bv.body, side * (3 + this.rnd() * 3.2) + dir.x * 0.8, 2.2 + this.rnd() * 3);
    Body.setAngularVelocity(bv.body, side * (0.1 + this.rnd() * 0.1));
    this.emit({ k: 'release', id: bv.b.id, x: bv.body.position.x / S, y: -bv.body.position.y / S, tier: bv.b.tier, side: true });
    this.kickDummies(bv.b.id, { x: side, y: 1 }, 0.7, true);
  }
  remove(bv, dir, power) {
    if (bv.gone) return;
    bv.gone = true;
    const p = bv.body.position;
    this.emit({ k: 'break', id: bv.b.id, x: p.x / S, y: -p.y / S, tier: bv.b.tier, key: bv.b.key, w: bv.b.w, h: bv.b.h, power, dx: dir.x, dy: dir.y });
    this.burst(bv, dir, power);
    this.M.Composite.remove(this.world, bv.body);
  }

  // ---- dummies ------------------------------------------------------------------------
  kickDummies(blockId, dir, power, quiet = false) {
    for (const dd of this.dummies) {
      if (dd.active || dd.d.host !== blockId) continue;
      this.activateDummy(dd, dir, power);
      if (!quiet || dd.d.role === 'foreman') this.emit({ k: 'dummy', x: dd.d.pose.torso.x, y: dd.d.pose.torso.y, power, role: dd.d.role });
    }
  }
  activateDummy(dd, dir, power) {
    const rag = buildRagdoll(this.M, dd.d.pose, this.group--, { category: CAT.dummy, mask: CAT.ground | CAT.block | CAT.proj }, S);
    const host = this.bodies.get(dd.d.host);
    const hv = host && host.released ? { x: stepToMps(host.body.velocity.x), y: -stepToMps(host.body.velocity.y) } : { x: 0, y: 0 };
    const up = 3.5 + power * 7, side = dir.x * (2 + power * 5);
    for (const b of rag.list) {
      this.setV(b, hv.x + side * (0.7 + this.rnd() * 0.6), hv.y + up * (0.7 + this.rnd() * 0.6));
      this.M.Body.setAngularVelocity(b, (this.rnd() - 0.5) * 0.35 * (1 + power));
    }
    this.M.Composite.add(this.world, [...rag.list, ...rag.constraints]);
    dd.active = rag; dd.d.face = 'dizzy'; dd.d.state = 'flop';
  }

  // ---- the thrown object -------------------------------------------------------------------
  /** Pose of the object while it is still being driven by the flight arithmetic; null once a body takes over. */
  makeProjectile(x, y, vx, vy) {
    const { Bodies, Body, Composite } = this.M;
    const sp = this.projSpec;
    const body = sp.box ? Bodies.rectangle(x * S, -y * S, sp.w * S, sp.h * S, { chamfer: { radius: Math.min(sp.w, sp.h) * 0.12 * S } }) : Bodies.circle(x * S, -y * S, sp.r * S);
    body.collisionFilter = { category: CAT.proj, mask: CAT.ground | CAT.block | CAT.dummy, group: 0 };
    body.friction = 0.55; body.frictionStatic = 0.9; body.restitution = sp.restitution; body.frictionAir = 0.004; body.slop = 0.4;
    Body.setMass(body, sp.mass);
    body.plugin = { kind: 'proj' };
    this.setV(body, vx, vy);
    Body.setAngularVelocity(body, -vx * 0.01);
    Composite.add(this.world, body);
    this.projBody = body;
  }
  projPose() {
    if (!this.projBody) return null;
    const b = this.projBody;
    return { x: b.position.x / S, y: -b.position.y / S, rot: b.angle, vx: stepToMps(b.velocity.x), vy: -stepToMps(b.velocity.y) };
  }
  startProjectile() {
    const hit = this.res.impact, path = this.res.flight.path;
    if (hit) {
      let vx, vy, x = hit.stopX, y = hit.stopY;
      if (this.res.endPath && this.res.endPath.length > 2) {
        const e = this.res.endPath, a = e[0], b = e[Math.min(3, e.length - 1)], dt = (b.t - a.t) || 0.05;
        vx = (b.x - a.x) / dt; vy = (b.y - a.y) / dt; x = a.x; y = a.y;
      } else {
        const first = path.find((q) => q.t >= hit.time) || path[path.length - 1];
        vx = -0.3 * first.vx; vy = 2.4 + 0.1 * Math.abs(first.vx);
      }
      this.makeProjectile(x, Math.max(y, this.projSpec.r + 0.05), vx, vy);
    } else {
      const n = path.length, a = path[Math.max(0, n - 4)], b = path[n - 1], dt = (b.t - a.t) || 0.05;
      this.makeProjectile(b.x, Math.max(b.y, this.projSpec.r + 0.05), (b.x - a.x) / dt, (b.y - a.y) / dt);
    }
  }

  // ---- stepping ---------------------------------------------------------------------------
  update(t) {
    if (t <= this.t) return;
    const total = t - this.t;
    const n = Math.max(1, Math.ceil(total * 60 - 1e-6));
    const sub = total / n;
    for (let i = 0; i < n; i++) {
      this.t += sub;
      while (this.si < this.schedule.length && this.schedule[this.si].at <= this.t) this.apply(this.schedule[this.si++]);
      if (!this.projBody && this.stopT !== null && this.t >= this.stopT) this.startProjectile();
      for (const [id, tt] of this.teeter) if (!tt.said && this.t >= tt.t0) { tt.said = true; const bvv = this.bodies.get(id); if (bvv) this.emit({ k: 'creak', id, x: bvv.body.position.x / S, y: -bvv.body.position.y / S - bvv.b.h * CELL / 2, tier: bvv.b.tier }); }
      for (const bv of this.bodies.values()) if (bv.dying && !bv.gone && this.t >= bv.dying) this.remove(bv, { x: 0.3, y: 0.7 }, 0.6);
      if (!this.frozen && this.t >= this.plan.end - BLEND) this.freeze();
      this.M.Engine.update(this.eng, Math.min(sub * 1000, 16.66));
      this.limits();
    }
    // trim: chunks that have settled for a while no longer need simulating
    if (this.chunks.length && (this.sleepT += total) > 0.4) {
      this.sleepT = 0;
      for (const c of this.chunks) if (!c.rest && c.body.isSleeping && this.t - c.born > 0.8) { c.rest = true; }
    }
  }
  /** Keep ragdoll limbs and tumbling blocks inside believable angles. */
  limits() {
    const { Body } = this.M;
    // matter can fling a body when two overlap; nothing in a toppling tower moves faster than this
    const cap = (b, mps) => { const lim = (mps * S) / 60, v = b.velocity, sp = Math.hypot(v.x, v.y); if (sp > lim) Body.setVelocity(b, { x: (v.x * lim) / sp, y: (v.y * lim) / sp }); };
    for (const bv of this.bodies.values()) if (bv.released && !bv.gone && !this.frozen) cap(bv.body, 16);
    for (const dd of this.dummies) if (dd.active && !this.frozen) for (const b of dd.active.list) cap(b, 20);
    for (const c of this.chunks) if (!c.body.isSleeping) cap(c.body, 22);
    // gentle guidance: a block the arithmetic keeps is nudged toward its cell, harder once it has landed
    for (const [id, bv] of this.bodies) {
      if (!bv.released || bv.gone || this.frozen) continue;
      const f = this.final.get(id), it = this.lastFall.get(id);
      if (!f || !f.alive) continue;
      const landed = this.t > it.at + it.d;
      const gx = (this.x0 + (f.c + bv.b.w / 2) * CELL) * S - bv.body.position.x, gy = -((f.r + bv.b.h / 2) * CELL) * S - bv.body.position.y;
      const k = landed ? 0.035 : 0.006;
      const vx = bv.body.velocity.x * (landed ? 0.9 : 0.995) + Math.max(-2.5, Math.min(2.5, gx * k));
      const vy = bv.body.velocity.y + (landed ? Math.max(-2.5, Math.min(2.5, gy * k * 0.6)) : 0);
      Body.setVelocity(bv.body, { x: vx, y: vy });
      if (landed) { const a = normAngle(bv.body.angle); Body.setAngularVelocity(bv.body, bv.body.angularVelocity * 0.85 - a * 0.06); }
    }
    for (const dd of this.dummies) {
      if (!dd.active) continue;
      const r = dd.active, t = r.torso;
      for (const [name, lim] of LIMITS) {
        const b = r[name], rel = normAngleFull(b.angle - t.angle);
        if (rel > lim[1]) { Body.setAngle(b, t.angle + lim[1]); Body.setAngularVelocity(b, b.angularVelocity * 0.4); }
        else if (rel < lim[0]) { Body.setAngle(b, t.angle + lim[0]); Body.setAngularVelocity(b, b.angularVelocity * 0.4); }
      }
    }
  }
  freeze() {
    if (this.frozen) return;
    this.frozen = true;
    const { Body } = this.M;
    this.frozenPose = new Map();
    for (const [id, bv] of this.bodies) {
      if (bv.gone) continue;
      if (bv.released && !bv.dying) { this.frozenPose.set(id, this.blockPose(bv)); Body.setStatic(bv.body, true); }
    }
    for (const dd of this.dummies) if (dd.active) {
      for (const b of dd.active.list) Body.setStatic(b, true);
      dd.rest = ragdollPose(dd.active, S);
      const fb = this.finalSupport(dd.rest.torso.x, poseBottom(dd.rest));
      dd.dy = Math.abs(fb) < 1.6 ? fb : 0;
    }
  }
  /** How far a dummy lying at x must shift so it sits on whatever the arithmetic left below it. */
  finalSupport(x, bottom) { return supportAt(this.res.tower, x, bottom, 1.0).y - bottom; }

  // ---- output for the renderer --------------------------------------------------------------------
  /** Replace the kinematic poses in `views` (from blockViews) by simulated ones. */
  applyViews(views, t) {
    const k = this.t >= this.plan.end - BLEND ? Math.min(1, (t - (this.plan.end - BLEND)) / (BLEND * 0.8)) : 0;
    const e = k * k * (3 - 2 * k);
    for (const v of views) {
      const bv = this.bodies.get(v.id);
      if (!bv || bv.gone) continue;
      if (bv.released) {
        const p = this.frozen ? this.frozenPose.get(v.id) || this.blockPose(bv) : this.blockPose(bv);
        let x = (p.x - this.x0) / CELL - v.w / 2, y = p.y / CELL - v.h / 2, rot = p.a;
        if (e > 0) {
          const f = this.final.get(v.id);
          if (f && f.alive) { rot = normAngle(rot); x += (f.c - x) * e; y += (f.r - y) * e; rot *= 1 - e; }
        }
        v.x = x; v.y = y; v.rot = rot; v.alpha = 1;
      } else {
        const tt = this.teeter.get(v.id);
        if (tt && t >= tt.t0 && t < tt.t1 + 0.02) {
          const p = Math.min(1, (t - tt.t0) / (tt.t1 - tt.t0)), dt = t - tt.t0;
          v.rot = (v.rot || 0) + tt.side * 0.07 * p * p + (0.01 + 0.035 * p) * Math.sin(dt * (26 + 30 * p) + v.id);
          v.x += tt.side * 0.05 * p * p + 0.03 * p * Math.sin(dt * 41 + 2 * v.id);
        }
        const w = this.wobble.get(v.id);
        if (w) { const dt = t - w.t0, d = Math.exp(-5 * dt); v.rot = (v.rot || 0) + w.amp * d * Math.sin(34 * dt) * w.dir; v.x += w.amp * 0.5 * d * Math.sin(30 * dt + 1) * w.dir; }
      }
    }
  }
  teeteringHosts(t) { const out = new Set(); for (const [id, tt] of this.teeter) if (t >= tt.t0 && t < tt.t1 + 0.4) out.add(id); return out; }
  chunkViews() {
    const out = [];
    for (const c of this.chunks) {
      const v = c.body.vertices, age = this.t - c.born;
      const fade = c.rest && age > 5 ? Math.max(0, 1 - (age - 5) / 1) : 1;
      if (fade <= 0) continue;
      out.push({ verts: v.map((q) => [q.x / S, -q.y / S]), fill: c.fill, edge: c.edge, kind: c.kind, shape: c.shape, alpha: fade, cx: c.body.position.x / S, cy: -c.body.position.y / S });
    }
    return out;
  }
  dummyViews() {
    return this.dummies.map((dd) => {
      if (!dd.active) return { id: dd.id, active: false };
      if (this.frozen && dd.rest) {
        const k = Math.min(1, (this.t - (this.plan.end - BLEND)) / (BLEND * 0.8)), e = k * k * (3 - 2 * k), dy = (dd.dy || 0) * e;
        const pose = {}; for (const key of Object.keys(dd.rest)) pose[key] = { ...dd.rest[key], y: dd.rest[key].y + dy };
        return { id: dd.id, active: true, pose, face: 'dizzy' };
      }
      return { id: dd.id, active: true, pose: ragdollPose(dd.active, S), face: 'dizzy' };
    });
  }
  /** What stays behind when the throw ends: debris on the ground, lying dummies, the object's rest pose. */
  leave() {
    const debris = [];
    const per = new Map();
    for (const c of this.chunks) {
      const p = c.body.position, y = -p.y / S;
      if (y > 0.9 || c.body.speed > 1.2) continue;
      const n = per.get(c.id) || 0; if (n >= 3) continue; per.set(c.id, n + 1);
      debris.push({ x: p.x / S, y, a: c.body.angle, kind: c.kind, fill: c.fill, edge: c.edge, verts: c.body.vertices.map((q) => [(q.x - p.x) / S, -(q.y - p.y) / S]) });
    }
    const dummies = this.dummies.filter((d) => d.active).map((dd) => {
      const pose = dd.rest || ragdollPose(dd.active, S), dy = dd.dy || 0, out = {};
      for (const key of Object.keys(pose)) out[key] = { ...pose[key], y: pose[key].y + dy };
      return { id: dd.id, pose: out };
    });
    return { debris, dummies, proj: this.projPose() };
  }
  destroy() { try { this.M.Events.off(this.eng); this.M.World && this.M.World.clear(this.world); this.M.Engine.clear(this.eng); } catch { /* ignore */ } }
}

function normAngleFull(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
