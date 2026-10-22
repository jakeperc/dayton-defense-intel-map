// SEC 05 — the verify-it-yourself queue (data/watchlist.json). Marking an item
// verified is session-only: it flips the target organizations' grade to [D].
import { WATCHLIST, nodeById } from '../lib/data.js';
import { selection, refreshOpenInspector } from './inspector.js';

function markVerified(id) {
  const item = WATCHLIST.find((v) => v.id === id);
  if (!item || item.status === 'verified') return;
  item.status = 'verified';
  if (!item.finding) item.finding = 'Marked verified in this session. No independent confirmation is recorded here.';
  for (const tid of item.targets) {
    const nd = nodeById[tid];
    if (nd) nd.dossier.grade = 'D';
  }
  const { org } = selection();
  if (org && item.targets.includes(org)) refreshOpenInspector();
  render();
}

function render() {
  const host = document.getElementById('vq-list');
  host.innerHTML = '';
  const nV = WATCHLIST.filter((v) => v.status === 'verified').length;
  const nP = WATCHLIST.filter((v) => v.status === 'partial').length;
  const nO = WATCHLIST.length - nV - nP;

  const bar = document.createElement('div');
  bar.className = 'vq-summary';
  bar.innerHTML =
    '<span class="vqs ok">' + nV + ' RESOLVED</span><span class="vqs part">' + nP + ' PARTIAL</span><span class="vqs open">' + nO + ' OPEN</span>' +
    '<span class="vqs-note">Resolved items were checked against primary sources. Two corrected outright errors in this product — both documented below rather than quietly deleted.</span>';
  host.appendChild(bar);

  for (const item of WATCHLIST) {
    const st = item.status || 'open';
    const div = document.createElement('div');
    div.className = 'vq-item ' + st;
    const btn = st === 'verified' ? '<button class="vq-btn" disabled>✓ RESOLVED</button>' : '<button class="vq-btn" data-id="' + item.id + '">MARK VERIFIED</button>';
    div.innerHTML =
      '<div class="vq-top"><div><h3>' + item.title + '</h3><div class="vq-tag">' + item.tag + '</div></div>' + btn + '</div>' +
      '<div class="vq-query">' + item.query + '</div>' +
      '<div class="vq-note">' + item.note + '</div>' +
      (item.finding ? '<div class="vq-finding"><span class="vq-fk">' + (st === 'verified' ? 'FINDING' : 'STATUS') + '</span>' + item.finding + '</div>' : '') +
      (item.targets.length ? '<div class="vq-targets"><b>Flips grade on:</b> ' + item.targets.join(', ') + '</div>' : '');
    host.appendChild(div);
    const b = div.querySelector('.vq-btn:not([disabled])');
    if (b) b.addEventListener('click', () => markVerified(b.dataset.id));
  }
}

export function initWatchlist() {
  render();
}
