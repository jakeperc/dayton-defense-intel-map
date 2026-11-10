#!/usr/bin/env node
// Checks the JSON in /data before anything is built or published.
// Run with `npm run validate`. Exits 1 and lists every problem it finds.
//
// It checks structure and referential integrity (every id that points
// somewhere points at something real). It cannot check whether a fact is
// true; that is what the sources fields and the watchlist are for.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

function load(name) {
  const path = join(root, 'data', name);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    err(`data/${name}`, `could not be read as JSON (${e.message})`);
    return null;
  }
}

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(v);
function need(obj, keys, where, test = isStr) {
  for (const k of keys) if (!test(obj?.[k])) err(where, `missing or empty "${k}"`);
}
function unique(list, where) {
  const seen = new Set();
  for (const id of list) {
    if (seen.has(id)) err(where, `duplicate id "${id}"`);
    seen.add(id);
  }
  return seen;
}

const TYPES = ['anchor', 'intel', 'eng', 'guard', 'reserve', 'network'];
const GRADES = ['D', 'I', 'V'];
const COLORS = ['brass', 'teal', 'steel', 'signal', 'ink', 'green', 'violet'];
const RADAR_STATUS = ['active', 'compete', 'recurring', 'track'];
const WATCH_STATUS = ['open', 'partial', 'verified'];

const sites = load('sites.json');
const network = load('network.json');
const contracts = load('contracts.json');
const watchlist = load('watchlist.json');
const geography = load('geography.json');
const money = load('money.json');
const meta = load('meta.json');

// ---------- geography ----------
let cityNames = new Set();
let proj = null;
if (geography) {
  proj = geography.projection;
  need(proj, ['lat_center', 'lon_center', 'units_per_degree', 'lon_scale_lat', 'terrain_width', 'terrain_depth'], 'geography.projection', isNum);
  if (!Array.isArray(geography.cities) || !geography.cities.length) err('geography', 'cities must be a non-empty list');
  cityNames = unique((geography.cities || []).map((c) => c.name), 'geography.cities');
  for (const c of geography.cities || []) {
    const w = `geography.cities "${c.name}"`;
    need(c, ['name'], w);
    need(c, ['lat', 'lon'], w, isNum);
    if (![1, 2].includes(c.tier)) err(w, 'tier must be 1 (major) or 2 (minor)');
  }
  for (const h of geography.highways || []) {
    const w = `geography.highways "${h.name}"`;
    need(h, ['name'], w);
    if (!Array.isArray(h.via) || h.via.length < 2) err(w, 'via needs at least two city names');
    for (const n of h.via || []) if (!cityNames.has(n)) err(w, `via names "${n}", which is not in geography.cities`);
    if (!Number.isInteger(h.label_segment) || h.label_segment < 0 || h.label_segment > (h.via?.length || 0) - 2) {
      err(w, `label_segment must be an integer from 0 to ${(h.via?.length || 2) - 2}`);
    }
  }
}

// projected position must land on the terrain, or the site floats off the edge of the map
function onTerrain(lat, lon, where) {
  if (!proj || !isNum(lat) || !isNum(lon)) return;
  const cl = Math.cos((proj.lon_scale_lat * Math.PI) / 180);
  const x = (lon - proj.lon_center) * proj.units_per_degree * cl;
  const z = -(lat - proj.lat_center) * proj.units_per_degree;
  if (Math.abs(x) > proj.terrain_width / 2 || Math.abs(z) > proj.terrain_depth / 2) {
    err(where, `lat/lon (${lat}, ${lon}) falls outside the terrain; widen geography.projection or check the coordinates`);
  }
}
for (const c of geography?.cities || []) onTerrain(c.lat, c.lon, `geography.cities "${c.name}"`);

// ---------- sites & organizations ----------
const siteIds = new Set();
const orgIds = new Set();
const orgVerify = [];
const orgGrade = new Map();
if (sites) {
  if (!Array.isArray(sites.sites) || !sites.sites.length) err('sites', 'sites must be a non-empty list');
  for (const id of unique((sites.sites || []).map((s) => s.id), 'sites')) siteIds.add(id);
  const allOrg = [];
  for (const s of sites.sites || []) {
    const w = `sites "${s.id}"`;
    need(s, ['id', 'label'], w);
    need(s, ['lat', 'lon'], w, isNum);
    onTerrain(s.lat, s.lon, w);
    if (!Array.isArray(s.members) || !s.members.length) err(w, 'members must be a non-empty list');
    for (const m of s.members || []) {
      const mw = `org "${m.id}" (site ${s.id})`;
      allOrg.push(m.id);
      need(m, ['id', 'name', 'sub', 'type'], mw);
      if (!TYPES.includes(m.type)) err(mw, `type "${m.type}" must be one of ${TYPES.join(', ')}`);
      const d = m.dossier;
      if (!d) {
        err(mw, 'missing dossier');
        continue;
      }
      need(d, ['ref', 'title', 'sources'], `${mw} dossier`);
      if (!GRADES.includes(d.grade)) err(`${mw} dossier`, `grade "${d.grade}" must be one of ${GRADES.join(', ')}`);
      if (!Array.isArray(d.rows) || !d.rows.length) err(`${mw} dossier`, 'rows must be a non-empty list');
      (d.rows || []).forEach((r, i) => need(r, ['label', 'text'], `${mw} dossier.rows[${i}]`));
      if (m.verify) orgVerify.push([mw, m.verify]);
      orgGrade.set(m.id, d.grade);
      // a reported-but-unconfirmed claim must say how it would be confirmed
      if (d.grade === 'V' && !m.verify) err(mw, 'is graded V but has no "verify" pointing at a watchlist item');
    }
  }
  for (const id of unique(allOrg, 'organizations (across all sites)')) orgIds.add(id);
}

// ---------- watchlist ----------
const watchIds = new Set();
if (watchlist) {
  for (const id of unique((watchlist.items || []).map((v) => v.id), 'watchlist')) watchIds.add(id);
  for (const v of watchlist.items || []) {
    const w = `watchlist "${v.id}"`;
    need(v, ['id', 'title', 'tag', 'query', 'note'], w);
    if (!WATCH_STATUS.includes(v.status)) err(w, `status "${v.status}" must be one of ${WATCH_STATUS.join(', ')}`);
    if (v.status !== 'open' && !isStr(v.finding)) err(w, `a ${v.status} item needs a "finding" saying what was found`);
    if (!Array.isArray(v.targets)) err(w, 'targets must be a list (it may be empty)');
    // a verified item has confirmed its targets: none may still be graded V
    if (v.status === 'verified') for (const t of v.targets || []) if (orgGrade.get(t) === 'V') err(w, `is verified, but its target "${t}" is still graded V in sites.json`);
    for (const t of v.targets || []) if (!orgIds.has(t)) err(w, `targets "${t}", which is not an organization id in sites.json`);
  }
}
for (const [w, vid] of orgVerify) if (!watchIds.has(vid)) err(w, `verify points at "${vid}", which is not a watchlist id`);

// ---------- network ----------
if (network) {
  const pos = network.positions || {};
  for (const [id, xy] of Object.entries(pos)) {
    if (!orgIds.has(id)) err('network.positions', `"${id}" is not an organization id in sites.json`);
    if (!Array.isArray(xy) || xy.length !== 2 || !xy.every(isNum)) err('network.positions', `"${id}" must be [x, y]`);
  }
  (network.edges || []).forEach((e, i) => {
    const w = `network.edges[${i}] (${e.a} → ${e.b})`;
    for (const end of ['a', 'b']) if (!pos[e[end]]) err(w, `"${e[end]}" has no entry in network.positions`);
    if (e.a === e.b) err(w, 'an edge cannot connect a node to itself');
    if (!isStr(e.label)) err(w, 'missing label');
  });
}

// ---------- contracts ----------
if (contracts) {
  (contracts.radar || []).forEach((r, i) => {
    const w = `contracts.radar[${i}] "${r.title}"`;
    need(r, ['title', 'sub', 'chip', 'sources'], w);
    if (!RADAR_STATUS.includes(r.status)) err(w, `status "${r.status}" must be one of ${RADAR_STATUS.join(', ')}`);
    if (!GRADES.includes(r.grade)) err(w, `grade "${r.grade}" must be one of ${GRADES.join(', ')}`);
    (r.cells || []).forEach((c, j) => need(c, ['label', 'html'], `${w} cells[${j}]`));
  });
  (contracts.ledger || []).forEach((r, i) => {
    const w = `contracts.ledger[${i}] "${r.vehicle}"`;
    need(r, ['vehicle', 'primes', 'amount', 'date', 'notes'], w);
    if (!GRADES.includes(r.grade)) err(w, `grade "${r.grade}" must be one of ${GRADES.join(', ')}`);
  });
  (contracts.doors || []).forEach((o, i) => {
    const w = `contracts.doors[${i}] "${o.name}"`;
    need(o, ['name', 'key', 'body', 'link', 'link_text'], w);
    if (o.link && !/^https:\/\//.test(o.link)) err(w, 'link must be an https:// URL');
  });
  const tp = contracts.usaspending_filters?.time_period?.[0];
  if (!tp || !isDate(tp.start_date) || !isDate(tp.end_date)) err('contracts.usaspending_filters', 'time_period[0] needs start_date and end_date (YYYY-MM-DD)');
}

// ---------- money ----------
if (money) {
  const ids = unique((money.nodes || []).map((n) => n.id), 'money.nodes');
  for (const n of money.nodes || []) {
    const w = `money.nodes "${n.id}"`;
    need(n, ['id', 'label', 'amount'], w);
    need(n, ['x', 'y', 'h'], w, isNum);
    if (!COLORS.includes(n.color)) err(w, `color "${n.color}" must be one of ${COLORS.join(', ')}`);
  }
  const out = {};
  for (const f of money.flows || []) {
    const w = `money.flows ${f.from} → ${f.to}`;
    if (!ids.has(f.from)) err(w, `"${f.from}" is not a money node`);
    if (!ids.has(f.to)) err(w, `"${f.to}" is not a money node`);
    if (!isNum(f.value) || f.value <= 0) err(w, 'value must be a positive number');
    out[f.from] = (out[f.from] || 0) + (f.value || 0) + 8;
  }
  // stacked outflows (each plus an 8px gap) should fit down the source bar
  for (const n of money.nodes || []) {
    if (out[n.id] && out[n.id] - 8 > n.h + 0.5) warn(`money.nodes "${n.id}"`, `outgoing flows (${out[n.id] - 8}px with gaps) are taller than the bar (${n.h}px)`);
  }
}

// ---------- geography presets (need site ids) ----------
for (const p of geography?.presets || []) {
  const w = `geography.presets "${p.id}"`;
  need(p, ['id', 'label'], w);
  if (!['region', 'dayton'].includes(p.id) && !siteIds.has(p.id)) err(w, 'id must be "region", "dayton", or a site id');
}

// ---------- meta ----------
if (meta) {
  need(meta, ['title', 'subtitle', 'site_url', 'repo'], 'meta');
  for (const k of ['data_refreshed']) if (!isDate(meta[k])) err('meta', `"${k}" must be YYYY-MM-DD`);
  for (const k of ['compiled', 'sites_verified', 'cities_verified']) if (!isDate(meta[k])) err('meta', `"${k}" must be YYYY-MM or YYYY-MM-DD`);
  if (meta.site_url && !/^https:\/\/.+\/$/.test(meta.site_url)) err('meta', 'site_url must be an https:// URL ending in /');
}

// ---------- code that names sites (src/modules/atlas.js) ----------
try {
  const atlas = readFileSync(join(root, 'src/modules/atlas.js'), 'utf8');
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const block = (name) => (atlas.match(new RegExp(`const ${name} = ([\\s\\S]*?);\\n`)) || [])[1] || '';
  const named = new Set([...block('STORY_BEATS').matchAll(/'([a-z_]+)'/g), ...block('ARCS').matchAll(/'([a-z_]+)'/g), ...block('CLUSTER').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
  for (const id of named) if (!siteIds.has(id)) err('src/modules/atlas.js', `names site "${id}", which is not in sites.json`);
  const beats = (block('STORY_BEATS').match(/\{\s*pos:/g) || []).length;
  const sections = (html.match(/<[a-z]+ class="beat(?: [^"]*)?"/g) || []).length;
  for (const m of html.matchAll(/data-count="site:([^"]+)"/g)) if (!siteIds.has(m[1])) err('index.html', `data-count names site "${m[1]}", which is not in sites.json`);
  if (beats !== sections) err('src/modules/atlas.js', `STORY_BEATS has ${beats} camera beats but index.html has ${sections} .beat blocks; they must match`);
} catch (e) {
  warn('src', `could not cross-check atlas.js against index.html (${e.message})`);
}

// ---------- report ----------
const orgs = orgIds.size;
for (const w of warnings) console.warn('  warn  ' + w);
if (errors.length) {
  for (const e of errors) console.error('  error ' + e);
  console.error(`\n✗ ${errors.length} problem${errors.length > 1 ? 's' : ''} in /data. Nothing was built.`);
  process.exit(1);
}
console.log(`✓ data ok — ${siteIds.size} sites, ${orgs} organizations, ${network?.edges?.length ?? 0} network edges, ${watchIds.size} watchlist items, ${cityNames.size} cities`);
