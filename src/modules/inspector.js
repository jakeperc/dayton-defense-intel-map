// The paper "Inspector": one panel that shows a site's roster or an
// organization's evidence card. It lives beside the in-page atlas, becomes a
// bottom sheet on phones, and moves into the full map while that is open.
import { siteById, nodeById } from '../lib/data.js';
import { colFor, isMilComponent, isFull } from '../lib/dom.js';
import { mapApi, openMap, closeMap } from '../lib/bus.js';

const insp = document.getElementById('inspector');
const state = { org: null, site: null };

/** Current selection: { org, site } (either may be null). */
export const selection = () => ({ ...state });
export const getInspectorEl = () => insp;

const GRADE_TEXT = { D: 'Documented', I: 'Analytic inference', V: 'Verify before relying' };

function shell(eyebrow, ref, title, bodyHTML, backSiteId) {
  insp.innerHTML =
    '<div class="ins-grab"></div>' +
    (backSiteId
      ? '<button class="ins-back" data-back="' + backSiteId + '">← BACK TO ' + siteById[backSiteId].label + ' ROSTER</button>'
      : '') +
    '<div class="ins-head"><button class="ins-close" data-close="1" aria-label="Close inspector">✕ CLOSE</button>' +
    '<div class="ins-eyebrow"><span>' + eyebrow + '</span><span>' + ref + '</span></div><h3>' + title + '</h3></div>' +
    bodyHTML +
    '<button class="ins-copy" data-copy="1">COPY LINK TO THIS VIEW</button>';

  const back = insp.querySelector('[data-back]');
  if (back) back.addEventListener('click', () => showSiteRoster(back.dataset.back));
  const close = insp.querySelector('[data-close]');
  if (close) close.addEventListener('click', closeInspectorSheet);
  const copy = insp.querySelector('[data-copy]');
  if (copy)
    copy.addEventListener('click', () => {
      const q = new URLSearchParams();
      if (isFull()) q.set('view', 'map');
      const id = state.org || state.site;
      if (id) q.set('site', id);
      const s = q.toString();
      const url = location.origin + location.pathname + (s ? '?' + s : '') + (isFull() ? '' : '#atlas');
      try {
        navigator.clipboard.writeText(url);
        copy.textContent = 'LINK COPIED';
        setTimeout(() => (copy.textContent = 'COPY LINK TO THIS VIEW'), 1600);
      } catch (e) {
        copy.textContent = url;
      }
    });

  insp.classList.add('open');
  if (isFull()) mapApi.syncURL();
}

function orgBody(nd) {
  const d = nd.dossier;
  return (
    '<div class="ins-body">' +
    '<div class="ins-row"><div class="ins-k">Grade</div><div class="ins-v"><span class="badge ' + d.grade + '">[' + d.grade + ']</span> ' +
    GRADE_TEXT[d.grade] + '</div></div>' +
    d.rows.map((r) => '<div class="ins-row"><div class="ins-k">' + r.label + '</div><div class="ins-v">' + r.text + '</div></div>').join('') +
    '<div class="ins-row"><div class="ins-k">Sources</div><div class="ins-v src">' + d.sources + '</div></div>' +
    '<div class="stamp">OPEN SOURCE ONLY</div>' +
    '</div>'
  );
}

export function selectOrg(id) {
  const nd = nodeById[id];
  if (!nd) return;
  state.org = id;
  state.site = nd.siteId;
  const multi = siteById[nd.siteId].members.length > 1;
  shell('Inspector · ' + nd.sub, 'REF ' + nd.dossier.ref, nd.dossier.title, orgBody(nd), multi ? nd.siteId : null);
  document.querySelectorAll('#net-svg .node').forEach((g) => g.classList.toggle('sel', g.dataset.org === id));
  mapApi.highlightSite(nd.siteId);
}

export function showSiteRoster(siteId) {
  const s = siteById[siteId];
  if (!s) return;
  if (s.members.length === 1) {
    selectOrg(s.members[0].id);
    return;
  }
  state.org = null;
  state.site = siteId;
  const rows = s.members
    .map((m) => {
      const mil = isMilComponent(m.type);
      return (
        '<button class="roster-row" data-org="' + m.id + '"><span class="sw" style="background:' + (mil ? 'transparent' : colFor(m.type)) +
        ';border:1.5px ' + (mil ? 'dashed' : 'solid') + ' ' + colFor(m.type) + '"></span><span class="rn">' + m.name + '</span><span class="rs">' + m.sub + '</span></button>'
      );
    })
    .join('');
  shell('Site roster', s.members.length + ' ORGS', s.label, '<div class="ins-body" style="padding-top:4px">' + rows + '</div>', null);
  insp.querySelectorAll('[data-org]').forEach((b) => b.addEventListener('click', () => selectOrg(b.dataset.org)));
  mapApi.highlightSite(siteId);
}

export function refreshOpenInspector() {
  if (state.org) selectOrg(state.org);
}

export function closeInspectorSheet() {
  insp.classList.remove('open');
}

export function initInspector() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (isFull()) {
      if (insp.classList.contains('open')) closeInspectorSheet();
      else closeMap();
      return;
    }
    closeInspectorSheet();
  });

  // Any page scroll dismisses the phone bottom sheet, so it can never trap the page.
  let lastY = window.scrollY || 0;
  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY || 0;
      if (!isFull() && Math.abs(y - lastY) > 4) closeInspectorSheet();
      lastY = y;
    },
    { passive: true },
  );

  // Buttons anywhere on the page: data-open-map="region" | "keep" | <site id>
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open-map]');
    if (!b) return;
    const v = b.dataset.openMap;
    if (v === 'region') openMap({});
    else if (v === 'keep') openMap({ keep: true });
    else openMap({ site: v });
  });
}
