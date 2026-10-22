// ?site=<site or organization id> opens that card beside the in-page atlas.
// ?view=map[&site=...] is handled by the atlas once it has loaded.
import { siteById, nodeById } from '../lib/data.js';
import { selectOrg, showSiteRoster } from './inspector.js';

export function applyDeepLink() {
  const q = new URLSearchParams(location.search);
  if (q.get('view') === 'map') return;
  const id = q.get('site');
  if (!id || !(nodeById[id] || siteById[id])) return;
  if (siteById[id] && siteById[id].members.length > 1) showSiteRoster(id);
  else selectOrg(id);
  if (!location.hash) setTimeout(() => document.getElementById('atlas').scrollIntoView(), 80);
}
