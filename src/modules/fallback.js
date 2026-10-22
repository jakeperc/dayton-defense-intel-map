// No WebGL (or the 3D chunk failed to load): every site stays inspectable as a
// plain grid, and the map-only buttons are hidden.
import { SITES } from '../lib/data.js';
import { cancelPendingMap } from '../lib/bus.js';
import { selectOrg } from './inspector.js';

let shown = false;

export function showFallback() {
  if (shown) return;
  shown = true;
  cancelPendingMap();
  document.getElementById('boot').classList.add('done');
  document.body.classList.add('no3d');
  document.getElementById('atlas-fallback').classList.add('show');
  document.getElementById('atlas-window').style.display = 'none';

  const host = document.getElementById('fb-grid');
  for (const s of SITES) {
    for (const m of s.members) {
      const b = document.createElement('button');
      b.className = 'fb-site';
      b.innerHTML = '<h4>' + m.name + '</h4><div class="fs">' + s.label + ' · ' + m.sub + '</div>';
      b.addEventListener('click', () => selectOrg(m.id));
      host.appendChild(b);
    }
  }
}
