// SEC 03 — the regional decomposition as a hand-built sankey (data/money.json).
import { MONEY } from '../lib/data.js';
import { el, C } from '../lib/dom.js';

export function buildMoney() {
  const svg = document.getElementById('money-svg');
  const pos = {};
  for (const n of MONEY.nodes) pos[n.id] = { ...n, _o: 0 };

  // stack each node's outgoing flows down its bar
  const offset = (a, value) => {
    const y = a.y + a._o;
    a._o += value + 8;
    return y;
  };

  for (const f of MONEY.flows) {
    const a = pos[f.from];
    const b = pos[f.to];
    const ax = a.x + 26;
    const ay0 = offset(a, f.value);
    const ay1 = ay0 + f.value;
    const bx = b.x;
    const by0 = b.y;
    const by1 = b.y + b.h;
    const mid = (ax + bx) / 2;
    el('path', {
      d: `M${ax},${ay0} C${mid},${ay0} ${mid},${by0} ${bx},${by0} L${bx},${by1} C${mid},${by1} ${mid},${ay1} ${ax},${ay1} Z`,
      fill: C[b.color],
    }, svg);
  }

  for (const n of MONEY.nodes) {
    el('rect', { x: n.x, y: n.y, width: 26, height: n.h, fill: C[n.color], rx: 2 }, svg);
    el('text', { class: 'sk-lbl', x: n.x + 34, y: n.y + 16 }, svg).textContent = n.label;
    el('text', { class: 'sk-amt', x: n.x + 34, y: n.y + 31 }, svg).textContent = n.amount;
  }
  el('text', { class: 'sk-amt', x: 30, y: 452 }, svg).textContent = MONEY.caveat;
}
