// Results screen: a looping replay of the throw that did the most damage. It reruns the same
// arithmetic and animates it with the same rigid-body sim as the game, on a small canvas.
import { throwAt, CELL } from './tower.js';
import { buildPlan, blockViews, projectileAt, makeParticles } from './anim.js';
import { Collapse, spriteMetres } from './sim.js';
import { drawScene } from './render.js';
import { makeRng, hash32 } from './daily.js';
import { G } from './physics.js';

export function bestThrow(deltas) {
  let best = -1, v = 0.02;
  deltas.forEach((d, i) => { if (d > v) { v = d; best = i; } });
  return best;
}

export function startReplay(game, canvas) {
  const M = typeof window !== 'undefined' ? window.Matter : null;
  const best = bestThrow(game.deltas), h = game.hist && game.hist[best];
  const wrap = canvas.parentElement;
  if (!M || !h) { if (wrap) wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  const p = game.puzzle, o = p.objects[h.shot[2]], [px, py] = h.shot;
  const res = throwAt(h.tower, o, px, py, { g: p.g, wind: p.wind });
  const plan = buildPlan(res, h.tower), imp = res.impact;
  const dpr = Math.min(window.devicePixelRatio || 1, 2), rect = canvas.getBoundingClientRect();
  const W = Math.max(200, Math.round(rect.width)), H = Math.round(W * 0.56);
  canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = `${H}px`;
  const ctx = canvas.getContext('2d');
  const T = game.tower0, tw = T.width * CELL;
  const towerH = Math.max(...T.blocks.map((b) => b.r0 + b.h));
  const gy = H * 0.84, ppm = Math.min(W / (tw + 4), (gy - 14) / (towerH * CELL + 1.6));
  const cam = { cx: T.x0 + tw / 2 - 0.7, ppm };
  const rnd = makeRng(hash32(`${game.key}|replay`));
  const start = imp ? Math.max(0, imp.time - 0.9) : 0;
  let sim, fx, t, last, hold, tick = 0;
  const reset = () => {
    sim = new Collapse(M, { towerBefore: h.tower, tower0: T, plan, res, obj: o, rngSeed: `${game.key}|replay`, dummies: [] });
    sim.update(start); sim.drain(); fx = makeParticles(rnd); t = start; hold = 0; last = performance.now(); game.replayImpacted = false;
  };
  reset();
  const loop = (now) => {
    if (!canvas.isConnected || $hidden()) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; tick += dt;
    if (t < plan.end + 0.2) { t += dt; sim.update(t); } else { hold += dt; if (hold > 1.4) reset(); }
    for (const e of sim.drain()) {
      if (e.k === 'break') { if (e.tier === 2) fx.splinters(e.x, e.y, 6); else if (e.tier === 1) { fx.shards(e.x, e.y, 8); fx.glint(e.x, e.y, 3); } else fx.chips(e.x, e.y, '#B4BECB', 6); fx.dust(e.x, e.y, 3, 10); }
      else if (e.k === 'thud' && e.speed > 4) fx.dust(e.x, Math.max(0.2, e.y), 2, 7);
    }
    if (imp && t >= imp.time && !game.replayImpacted) { game.replayImpacted = true; fx.burst(imp.x, imp.y, 14); fx.ring(imp.x, imp.y, 8); }
    fx.update(dt);
    const done = t >= plan.end;
    const views = done ? blockViews(res.tower, null, 0) : blockViews(h.tower, plan, t);
    if (!done) sim.applyViews(views, t);
    const pose = (sim.projPose()) || projectileAt(plan, o, t, p.g || G);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(ctx, { W, H, gy, cam, tower0: T, time: tick, wind: 0, particles: fx.list, blocks: views, chunks: done ? null : sim.chunkViews(), debris: [], dummies: [], proj: { id: o.id, x: pose.x, y: pose.y, rot: pose.rot || 0, size: spriteMetres(o), show: true }, shake: null, flash: 0 });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame((n) => { last = n; loop(n); });
}
const $hidden = () => { const r = document.getElementById('results'); return !r || r.classList.contains('hidden'); };
