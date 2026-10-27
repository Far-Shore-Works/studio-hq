// "Object museum" card facts, worked out from the object's own numbers (so they are true to the table).
import { OBJECTS } from '../data/objects.js';
import { RHO, G, dragK, fsqrt } from './physics.js';

const REFS = [['bowling balls', 'bowling'], ['basketballs', 'basketball'], ['tennis balls', 'tennis'], ['golf balls', 'golf'], ['ping-pong balls', 'pingpong']];

const fmt = (n) => (n >= 100 ? Math.round(n).toLocaleString('en-US') : n >= 10 ? String(Math.round(n)) : String(+n.toFixed(1)));

export function factsFor(obj) {
  const out = [];
  const k = dragK(obj);
  const term = fsqrt(G / k);                            // speed where drag equals weight, m/s
  out.push(`Falling through air, it tops out at about ${Math.round(term * 3.6)} km/h.`);
  const at72 = (k * 20 * 20) / G;                       // drag at 72 km/h as a multiple of weight
  out.push(at72 >= 1 ? `At 72 km/h the air pushes back ${fmt(at72)} times its own weight.` : `At 72 km/h the air pushes back with ${Math.round(at72 * 100)}% of its weight.`);
  for (const [label, id] of REFS) {
    const ref = OBJECTS.find((o) => o.id === id);
    if (ref && ref.id !== obj.id && obj.mass / ref.mass >= 2) { out.push(`It weighs as much as ${fmt(obj.mass / ref.mass)} ${label}.`); break; }
  }
  if (out.length < 3) {
    const lighter = REFS.map(([label, id]) => [label, OBJECTS.find((o) => o.id === id)]).filter(([, r]) => r && r.mass < obj.mass).pop();
    if (lighter) out.push(`It weighs as much as ${fmt(obj.mass / lighter[1].mass)} ${lighter[0]}.`);
  }
  return out;
}
