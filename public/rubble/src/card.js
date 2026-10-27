// The object card text: "Grand piano / 345 kg · heavy, flies true".
import { dragClass } from './daily.js';

export function describeCard(obj) {
  const kg = obj.mass >= 10 ? `${Math.round(obj.mass)} kg` : obj.mass >= 1 ? `${+obj.mass.toFixed(1)} kg` : obj.mass >= 0.1 ? `${+obj.mass.toFixed(2)} kg` : `${+(obj.mass * 1000).toFixed(obj.mass < 0.01 ? 1 : 0)} g`;
  const weight = obj.mass < 0.1 ? 'very light' : obj.mass < 1 ? 'light' : obj.mass < 20 ? 'medium' : 'heavy';
  const carry = { true: 'flies true', mid: 'feels the air', floaty: 'floaty' }[dragClass(obj)];
  const s = obj.size;
  const size = s >= 1 ? `${+s.toFixed(1)} m across` : `${Math.round(s * 100)} cm across`;
  return { name: obj.name, stats: `${kg} · ${weight}, ${carry}`, size };
}
