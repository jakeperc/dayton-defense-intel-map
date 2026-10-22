// SEC 02 — relationship graph, drawn from data/network.json.
import { NETWORK, nodeById } from '../lib/data.js';
import { el, colFor, isMilComponent } from '../lib/dom.js';
import { selectOrg } from './inspector.js';

const R_BY = { anchor: 13, intel: 10, eng: 10, guard: 11, reserve: 12, network: 9 };

export function buildNetwork() {
  const svg = document.getElementById('net-svg');
  const pos = NETWORK.positions;
  const gE = el('g', {}, svg);
  const gN = el('g', {}, svg);

  for (const e of NETWORK.edges) {
    const A = pos[e.a];
    const B = pos[e.b];
    const mx = (A[0] + B[0]) / 2 + (A[1] - B[1]) * 0.12;
    const my = (A[1] + B[1]) / 2 + (B[0] - A[0]) * 0.12;
    const p = el('path', { class: 'edge' + (e.highlight ? ' hi' : ''), d: 'M' + A[0] + ',' + A[1] + ' Q' + mx + ',' + my + ' ' + B[0] + ',' + B[1] }, gE);
    if (e.dashed) p.setAttribute('stroke-dasharray', '4 4');
    const t = el('text', { class: 'e-lbl', x: mx, y: my - 4, 'text-anchor': 'middle' }, gE);
    t.textContent = e.label;
  }

  for (const id of Object.keys(pos)) {
    const nd = nodeById[id];
    if (!nd) continue;
    const [x, y] = pos[id];
    const g = el('g', { class: 'node', tabindex: '0', role: 'button', 'aria-label': nd.name }, gN);
    g.dataset.org = id;
    g.setAttribute('transform', 'translate(' + x + ',' + y + ')');
    const r = id === 'nasic' ? 16 : R_BY[nd.type] || 9;
    const mil = isMilComponent(nd.type);
    const core = el('circle', { class: 'core', r, fill: mil ? 'var(--panel)' : colFor(nd.type), stroke: mil ? colFor(nd.type) : 'rgba(0,0,0,.35)' }, g);
    if (mil) core.setAttribute('stroke-dasharray', '3 2');
    const lbl = el('text', { class: 'n-lbl', x: 0, y: r + 15, 'text-anchor': 'middle' }, g);
    lbl.textContent = nd.name;
    g.addEventListener('click', () => selectOrg(id));
    g.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        selectOrg(id);
      }
    });
  }
}
