// The 3D atlas: terrain, sites, cities and interstates, the scroll-driven story
// camera, the in-page explorer, the locator minimap, and full-map mode.
// Loaded as its own chunk after first paint (three.js is the heavy part).
import * as THREE from 'three';
import { SITES, siteById, nodeById, CITIES, HIGHWAYS, PRESETS, cityByName } from '../lib/data.js';
import { GEO, geoXZ, MI_PER_UNIT } from '../lib/geo.js';
import { HEX, colFor, isMilComponent, el, isFull } from '../lib/dom.js';
import { registerMap } from '../lib/bus.js';
import { selectOrg, showSiteRoster, selection, getInspectorEl } from './inspector.js';
import { showFallback } from './fallback.js';

/* ======================== tunables ========================
   STORY_BEATS must line up 1:1 with the .beat blocks in index.html
   (hero first, closing overview last). pos is a camera position in world
   units, or [siteId, dx, y, dz] relative to a site; tgt is a look-at point,
   or [siteId, height]. */
const STORY_BEATS = [
  { pos: [0, 46, 74], tgt: [0, 0, -4] },
  { pos: ['blueash', 7, 8, 16], tgt: ['blueash', 2] },
  { pos: ['dayton_dt', -13, 9, 14], tgt: ['dayton_dt', 2.5] },
  { pos: ['wpafb', 10, 11, 17], tgt: ['wpafb', 3.5] },
  { pos: ['beavercreek', 12, 7, 10], tgt: ['beavercreek', 2.5] },
  { pos: ['springfield', -9, 9, 16], tgt: ['springfield', 2.5] },
  { pos: [0, 56, 84], tgt: [0, 0, -4] },
];
/** Raised brass arcs between sites: relationships, not roads. [from, to, opacity] */
const ARCS = [
  ['blueash', 'dayton_dt', 0.45],
  ['dayton_dt', 'wpafb', 0.6],
  ['wpafb', 'springfield', 0.5],
  ['wpafb', 'beavercreek', 0.6],
];
/** Camera distance when flying to each site (default 14). */
const SITE_DIST = { wpafb: 14, beavercreek: 12, dayton_dt: 13, springfield: 14, blueash: 16 };
/** Sites averaged to centre the "Dayton cluster" preset and the default in-page view. */
const CLUSTER = ['dayton_dt', 'wpafb', 'beavercreek'];
/** Cities included when fitting the whole region. */
const REGION_CITIES = ['Cincinnati', 'Dayton', 'Springfield', 'Hamilton', 'Middletown'];
/* ========================================================== */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
let started = false;

export function initAtlas() {
  if (started) return;
  started = true;
  const boot = document.getElementById('boot');
  const canvas = document.getElementById('stage');
  const insp = getInspectorEl();

  // three r163+ needs WebGL2; anything without it gets the no-3D grid.
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    showFallback();
    return;
  }
  // Colours are authored as plain sRGB hex and blended unmanaged (the look the
  // atlas was designed in); keep three's colour management out of the way.
  THREE.ColorManagement.enabled = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04070c, 0.0095);
  const cam = new THREE.PerspectiveCamera(52, 1, 0.1, 500);
  const W = (p) => {
    const a = geoXZ(p.lat, p.lon);
    return new THREE.Vector3(a[0], 0, a[1]);
  };
  const TW = GEO.TW;
  const TH = GEO.TH;

  // --- terrain (stylized; positions on it are true) ---
  const tGeo = new THREE.PlaneGeometry(TW, TH, 120, 88);
  tGeo.rotateX(-Math.PI / 2);
  const tPos = tGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i);
    const z = tPos.getZ(i);
    tPos.setY(i, Math.sin(x * 0.09) * Math.cos(z * 0.11) * 1.9 + Math.sin(x * 0.23 + 1.7) * Math.sin(z * 0.17) * 0.8 + Math.sin(z * 0.05 - 0.4) * 1.2 - 0.5);
  }
  const terrain = new THREE.Mesh(tGeo, new THREE.MeshBasicMaterial({ color: 0x232a52, wireframe: true, transparent: true, opacity: 0.34 }));
  terrain.position.y = -2.0;
  scene.add(terrain);

  // --- reference layers: interstates (illustrative routing) and cities ---
  const gHwy = new THREE.Group();
  const gCity = new THREE.Group();
  scene.add(gHwy);
  scene.add(gCity);
  const cityV = new Map();
  for (const c of CITIES) cityV.set(c.name, W(c));
  const hwyPts = new Map();
  const hwyLabelV = new Map();
  for (const h of HIGHWAYS) {
    const pts = h.via.map((n) => {
      const v = W(cityByName[n]);
      v.y = 0.1;
      return v;
    });
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const line = curve.getPoints(pts.length * 24);
    hwyPts.set(h.name, line);
    gHwy.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(line), new THREE.LineBasicMaterial({ color: 0x4a5590, transparent: true, opacity: 0.9 })));
    const lv = curve.getPoint((h.label_segment + 0.5) / (pts.length - 1));
    lv.y = 0.5;
    hwyLabelV.set(h.name, lv);
  }
  for (const c of CITIES) {
    const v = cityV.get(c.name);
    const big = c.tier === 1;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(big ? 0.55 : 0.38, big ? 0.74 : 0.52, 28),
      new THREE.MeshBasicMaterial({ color: 0xb8c2dc, transparent: true, opacity: big ? 0.75 : 0.5, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(v.x, 0.08, v.z);
    gCity.add(ring);
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(big ? 0.22 : 0.15, 14),
      new THREE.MeshBasicMaterial({ color: 0xe9edf7, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(v.x, 0.09, v.z);
    gCity.add(dot);
  }

  // --- sites: one pillar per organization, height by count, dashed = part-time component ---
  const siteAnchor = {};
  for (const s of SITES) siteAnchor[s.id] = W(s);
  const sitePick = [];
  const highlightRing = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 2.9, 48),
    new THREE.MeshBasicMaterial({ color: 0xe8b44c, transparent: true, opacity: 0, side: THREE.DoubleSide }),
  );
  highlightRing.rotation.x = -Math.PI / 2;
  highlightRing.position.y = 0.12;
  scene.add(highlightRing);

  function pillar(x, z, h, hex, dashed) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.62, h, 0.62), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: dashed ? 0.0 : 0.92 }));
    core.position.y = h / 2;
    g.add(core);
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.64, h, 0.64), new THREE.MeshBasicMaterial({ color: hex, wireframe: dashed, transparent: true, opacity: dashed ? 0.95 : 0.28 }));
    shell.position.y = h / 2;
    g.add(shell);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(1.0, h * 1.02, 1.0), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.17 }));
    glow.position.y = h / 2;
    g.add(glow);
    g.position.set(x, 0, z);
    return g;
  }
  for (const s of SITES) {
    const v = siteAnchor[s.id];
    const grp = new THREE.Group();
    grp.position.set(v.x, 0, v.z);
    const multi = s.members.length > 1;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(multi ? 2.3 : 1.25, multi ? 2.5 : 1.4, 0.14, 36),
      new THREE.MeshBasicMaterial({ color: 0x101737, transparent: true, opacity: 0.9 }),
    );
    base.position.y = 0.07;
    grp.add(base);
    const mm = s.members;
    if (!multi) {
      grp.add(pillar(0, 0, 2.7, HEX[mm[0].type] || 0x888888, isMilComponent(mm[0].type)));
    } else {
      grp.add(pillar(0, 0, 2.2 + mm.length * 0.22, HEX[mm[0].type], isMilComponent(mm[0].type)));
      mm.slice(1).forEach((m, i) => {
        const a = (i / (mm.length - 1)) * Math.PI * 2;
        const p = pillar(Math.cos(a) * 1.55, Math.sin(a) * 1.55, 0.9 + ((i * 7) % 5) * 0.12, HEX[m.type] || 0x888888, isMilComponent(m.type));
        p.scale.set(0.55, 1, 0.55);
        grp.add(p);
      });
    }
    grp.traverse((o) => {
      if (o.isMesh) {
        o.userData.siteId = s.id;
        sitePick.push(o);
      }
    });
    scene.add(grp);
  }

  for (const [a, b, op] of ARCS) {
    if (!siteAnchor[a] || !siteAnchor[b]) continue;
    const A = siteAnchor[a].clone();
    const B = siteAnchor[b].clone();
    A.y = 0.3;
    B.y = 0.3;
    const M = A.clone().add(B).multiplyScalar(0.5);
    M.y = 0.3 + A.distanceTo(B) * 0.2;
    const curve = new THREE.QuadraticBezierCurve3(A, M, B);
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), new THREE.LineBasicMaterial({ color: 0xe8b44c, transparent: true, opacity: op })));
  }

  // --- radar sweep from WPAFB + drifting signal returns ---
  const wv = siteAnchor.wpafb || new THREE.Vector3();
  const sweepMat = new THREE.MeshBasicMaterial({ color: 0xe8b44c, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const sweep = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.0, 96), sweepMat);
  sweep.rotation.x = -Math.PI / 2;
  sweep.position.set(wv.x, 0.18, wv.z);
  scene.add(sweep);
  const N = 360;
  const pts = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pts[i * 3] = (Math.random() - 0.5) * TW;
    pts[i * 3 + 1] = Math.random() * 9 + 1;
    pts[i * 3 + 2] = (Math.random() - 0.5) * TH;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x5ba8a0, size: 0.11, transparent: true, opacity: 0.5 }));
  scene.add(points);

  // --- HTML labels projected from 3D, priority-decluttered each frame ---
  const lblLayer = document.getElementById('lbl-layer');
  const labels = [];
  function addLabel(html, cls, v, kind, maxDist, pri, ay) {
    const d = document.createElement('div');
    d.className = 'lbl3d ' + cls;
    d.innerHTML = html;
    lblLayer.appendChild(d);
    labels.push({ el: d, v, kind, maxDist, pri, ay, w: 0, h: 0, on: false });
  }
  for (const s of SITES) {
    const n = s.members.length;
    addLabel(s.label + '<small>' + n + ' ORG' + (n > 1 ? 'S' : '') + '</small>', 'site', siteAnchor[s.id].clone().add(new THREE.Vector3(0, n > 1 ? 6.5 : 4.2, 0)), 'site', 999, 0, 1.1);
  }
  for (const c of CITIES) {
    const t1 = c.tier === 1;
    addLabel(c.name, t1 ? 'city t1' : 'city', cityV.get(c.name).clone().add(new THREE.Vector3(0, 0.35, 0)), t1 ? 'city1' : 'city2', t1 ? 190 : 75, t1 ? 1 : 3, 1.35);
  }
  for (const h of HIGHWAYS) addLabel(h.name, 'hwy', hwyLabelV.get(h.name), 'hwy', 120, 2, 0.5);
  labels.sort((a, b) => a.pri - b.pri);
  const layers = { cities: true, hwy: true };
  const layerOn = (k) => k === 'site' || (k === 'hwy' ? layers.hwy : layers.cities);

  // --- story camera: splines through the beats ---
  const story = document.getElementById('story');
  const atlasSec = document.getElementById('atlas');
  const look = new THREE.Vector3();
  const beatPos = (b) => (typeof b.pos[0] === 'string' ? siteAnchor[b.pos[0]].clone().add(new THREE.Vector3(b.pos[1], b.pos[2], b.pos[3])).setY(b.pos[2]) : new THREE.Vector3(...b.pos));
  const beatTgt = (b) => (typeof b.tgt[0] === 'string' ? siteAnchor[b.tgt[0]].clone().add(new THREE.Vector3(0, b.tgt[1], 0)) : new THREE.Vector3(...b.tgt));
  const posCurve = new THREE.CatmullRomCurve3(STORY_BEATS.map(beatPos), false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3(STORY_BEATS.map(beatTgt), false, 'centripetal');

  // --- orbit state + fly-to tween ---
  const ctr = CLUSTER.map((id) => siteAnchor[id]).filter(Boolean);
  const cluster = { x: ctr.reduce((a, v) => a + v.x, 0) / ctr.length, z: ctr.reduce((a, v) => a + v.z, 0) / ctr.length };
  const orbit = { yaw: 0.85, pitch: 0.52, dist: 21, tx: cluster.x, tz: cluster.z };
  let goal = null;
  const flyTo = (g) => {
    goal = { ...g };
  };
  const setChip = (k) => document.querySelectorAll('.chip-p').forEach((c) => c.classList.toggle('on', !!k && c.dataset.preset === k));
  const REGION = (() => {
    const ps = SITES.map((s) => siteAnchor[s.id]).concat(REGION_CITIES.filter((n) => cityV.has(n)).map((n) => cityV.get(n)));
    const xs = ps.map((p) => p.x);
    const zs = ps.map((p) => p.z);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, h: z1 - z0 };
  })();
  function regionGoal() {
    const vt = Math.tan((26 * Math.PI) / 180);
    const pitch = 1.22;
    const dW = (REGION.w * 1.25) / (2 * vt * cam.aspect);
    const dH = (REGION.h * 1.3 * Math.sin(pitch)) / (2 * vt);
    return { tx: REGION.cx, tz: REGION.cz, dist: clamp(Math.max(dW, dH), 30, 165), pitch, yaw: 0 };
  }
  function presetGoal(k) {
    if (k === 'region') return regionGoal();
    if (k === 'dayton') return { tx: cluster.x, tz: cluster.z, dist: 24, pitch: 0.62 };
    const v = siteAnchor[k];
    if (!v) return regionGoal();
    return { tx: v.x, tz: v.z, dist: SITE_DIST[k] || 14, pitch: 0.6 };
  }
  function orbitCam(out) {
    const r = Math.cos(orbit.pitch) * orbit.dist;
    out.set(orbit.tx + Math.sin(orbit.yaw) * r, Math.sin(orbit.pitch) * orbit.dist, orbit.tz + Math.cos(orbit.yaw) * r);
  }
  function panBy(dx, dy, base) {
    const k = orbit.dist * 0.0016;
    const s = Math.sin(base.yaw);
    const c = Math.cos(base.yaw);
    orbit.tx = clamp(base.tx - c * dx * k - s * dy * k, -TW / 2, TW / 2);
    orbit.tz = clamp(base.tz + s * dx * k - c * dy * k, -TH / 2, TH / 2);
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let blend = 0;
  const tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3(), oP = new THREE.Vector3(), oT = new THREE.Vector3(), pv = new THREE.Vector3();
  const storyProgress = () => {
    const r = story.getBoundingClientRect();
    return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
  };
  const atlasInView = () => {
    const r = atlasSec.getBoundingClientRect();
    return r.top < window.innerHeight * 0.55 && r.bottom > window.innerHeight * 0.45;
  };

  // --- picking: ray first, then nearest site on screen (zoomed-out pillars are a few px wide) ---
  const ray = new THREE.Raycaster();
  function hitAt(cx, cy, touch) {
    const rect = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1), cam);
    const h = ray.intersectObjects(sitePick, false)[0];
    if (h) return h.object.userData.siteId;
    let best = null;
    let bd = touch ? 30 : 18;
    for (const s of SITES) {
      const v = siteAnchor[s.id];
      for (const y of [0.2, 1.6]) {
        pv.set(v.x, y, v.z).project(cam);
        if (pv.z > 1) continue;
        const sx = (pv.x * 0.5 + 0.5) * rect.width + rect.left;
        const sy = (-pv.y * 0.5 + 0.5) * rect.height + rect.top;
        const d = Math.hypot(sx - cx, sy - cy);
        if (d < bd) {
          bd = d;
          best = s.id;
        }
      }
    }
    return best;
  }
  function pickAt(cx, cy, touch) {
    const id = hitAt(cx, cy, touch);
    if (id) {
      showSiteRoster(id);
      flyTo(presetGoal(id));
      setChip(id);
    }
  }

  // --- controls: the in-page window and the full map share one binding ---
  const toast = document.getElementById('atlas-toast');
  let toastT = 0;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove('on'), 1500);
  }
  function bindControls(elm, inPage) {
    let drag = null, moved = 0, t1 = null, two = null, hoverT = 0, lastTouchPick = 0;
    elm.addEventListener('contextmenu', (e) => e.preventDefault());
    elm.addEventListener('mousedown', (e) => {
      goal = null;
      moved = 0;
      setChip(null);
      drag = { x: e.clientX, y: e.clientY, yaw: orbit.yaw, pitch: orbit.pitch, tx: orbit.tx, tz: orbit.tz, pan: e.button === 2 || e.shiftKey };
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (drag) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
        if (drag.pan) panBy(dx, dy, drag);
        else {
          orbit.yaw = drag.yaw - dx * 0.0052;
          orbit.pitch = clamp(drag.pitch + dy * 0.004, 0.18, 1.4);
        }
      } else if (e.target === elm && performance.now() - hoverT > 60) {
        hoverT = performance.now();
        elm.style.cursor = hitAt(e.clientX, e.clientY) ? 'pointer' : '';
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (drag && moved < 6 && performance.now() - lastTouchPick > 600) pickAt(e.clientX, e.clientY);
      drag = null;
    });
    elm.addEventListener(
      'wheel',
      (e) => {
        // In the page, plain scrolling must scroll the page; zoom needs Ctrl/⌘ (also what trackpad pinch sends).
        if (inPage && !(e.ctrlKey || e.metaKey)) {
          showToast('Hold Ctrl / ⌘ and scroll to zoom — or open the full map');
          return;
        }
        e.preventDefault();
        goal = null;
        orbit.dist = clamp(orbit.dist * (1 + e.deltaY * 0.0012), 6, 170);
      },
      { passive: false },
    );
    const tdist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const tmid = (t) => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
    elm.addEventListener(
      'touchstart',
      (e) => {
        goal = null;
        setChip(null);
        if (e.touches.length === 1) {
          const t = e.touches[0];
          t1 = { x: t.clientX, y: t.clientY, yaw: orbit.yaw, pitch: orbit.pitch, moved: 0 };
          two = null;
        } else if (e.touches.length === 2) {
          const m = tmid(e.touches);
          two = { d: tdist(e.touches), x: m[0], y: m[1], dist: orbit.dist, tx: orbit.tx, tz: orbit.tz, yaw: orbit.yaw };
          t1 = null;
        }
      },
      { passive: true },
    );
    elm.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2 && two) {
          const m = tmid(e.touches);
          orbit.dist = clamp((two.dist * two.d) / Math.max(1, tdist(e.touches)), 6, 170);
          panBy(m[0] - two.x, m[1] - two.y, two);
          e.preventDefault();
        } else if (e.touches.length === 1 && t1) {
          const t = e.touches[0];
          const dx = t.clientX - t1.x;
          const dy = t.clientY - t1.y;
          t1.moved = Math.max(t1.moved, Math.abs(dx) + Math.abs(dy));
          // One finger scrolls the page in the in-page window; it orbits only in the full map.
          if (!inPage) {
            orbit.yaw = t1.yaw - dx * 0.0062;
            orbit.pitch = clamp(t1.pitch + dy * 0.005, 0.18, 1.4);
            e.preventDefault();
          }
        }
      },
      { passive: false },
    );
    elm.addEventListener('touchend', (e) => {
      if (t1 && t1.moved < 8 && e.changedTouches.length) {
        pickAt(e.changedTouches[0].clientX, e.changedTouches[0].clientY, true);
        lastTouchPick = performance.now();
      }
      if (e.touches.length === 0) {
        t1 = null;
        two = null;
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        two = null;
        t1 = { x: t.clientX, y: t.clientY, yaw: orbit.yaw, pitch: orbit.pitch, moved: 99 };
      }
    });
  }
  bindControls(document.getElementById('atlas-shield'), true);
  bindControls(document.getElementById('fm-shield'), false);

  // --- preset chips, layer toggles, zoom buttons ---
  for (const id of ['atlas-presets', 'fm-presets']) {
    const host = document.getElementById(id);
    if (!host) continue;
    for (const p of PRESETS) {
      const b = document.createElement('button');
      b.className = 'chip-p';
      b.textContent = p.label;
      b.dataset.preset = p.id;
      b.addEventListener('click', () => {
        flyTo(presetGoal(p.id));
        setChip(p.id);
      });
      host.appendChild(b);
    }
  }
  const mmLayers = {};
  document.querySelectorAll('.fm-tg').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.layer;
      const on = !layers[k];
      layers[k] = on;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
      (k === 'hwy' ? gHwy : gCity).visible = on;
      if (mmLayers[k]) mmLayers[k].style.display = on ? '' : 'none';
    }),
  );
  document.querySelectorAll('.fm-zoom [data-z]').forEach((b) =>
    b.addEventListener('click', () => {
      const z = b.dataset.z;
      if (z === 'fit') flyTo(regionGoal());
      else flyTo({ dist: clamp(orbit.dist * (z === 'in' ? 0.7 : 1.42), 6, 170) });
    }),
  );

  // --- locator minimap (north-up, same projection) ---
  const mm = document.getElementById('minimap');
  const mmSvg = document.getElementById('minimap-svg');
  const MW = 200, MH = 153;
  const toMM = (x, z) => [((x + TW / 2) / TW) * MW, ((z + TH / 2) / TH) * MH];
  el('rect', { x: 0, y: 0, width: MW, height: MH, fill: '#070b16' }, mmSvg);
  for (let i = 1; i < 6; i++) el('line', { x1: (i * MW) / 6, y1: 0, x2: (i * MW) / 6, y2: MH, stroke: '#121a33', 'stroke-width': 0.6 }, mmSvg);
  for (let i = 1; i < 5; i++) el('line', { x1: 0, y1: (i * MH) / 5, x2: MW, y2: (i * MH) / 5, stroke: '#121a33', 'stroke-width': 0.6 }, mmSvg);
  mmLayers.hwy = el('g', {}, mmSvg);
  for (const h of HIGHWAYS) {
    el('polyline', { points: hwyPts.get(h.name).map((p) => toMM(p.x, p.z).join(',')).join(' '), fill: 'none', stroke: '#3d4780', 'stroke-width': 1.1 }, mmLayers.hwy);
  }
  mmLayers.cities = el('g', {}, mmSvg);
  for (const c of CITIES) {
    const v = cityV.get(c.name);
    const q = toMM(v.x, v.z);
    el('circle', { cx: q[0], cy: q[1], r: c.tier === 1 ? 1.9 : 1.2, fill: '#B8C2DC' }, mmLayers.cities);
    if (c.tier === 1) {
      el('text', { x: q[0] + 3, y: q[1] - 2.5, 'font-size': 6.5, 'font-family': 'IBM Plex Mono, monospace', fill: '#8f9ac0', 'letter-spacing': '.06em' }, mmLayers.cities).textContent = c.name.toUpperCase();
    }
  }
  for (const s of SITES) {
    const q = toMM(siteAnchor[s.id].x, siteAnchor[s.id].z);
    const ty = s.members[0].type;
    el('circle', { cx: q[0], cy: q[1], r: s.members.length > 1 ? 3.2 : 2.4, fill: isMilComponent(ty) ? '#070b16' : colFor(ty), stroke: colFor(ty) === 'none' ? '#9AA6C2' : colFor(ty), 'stroke-width': 1.1 }, mmSvg);
  }
  const wedge = el('polygon', { fill: 'rgba(232,180,76,.16)', stroke: 'rgba(232,180,76,.75)', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }, mmSvg);
  const camDot = el('circle', { r: 2.6, fill: '#E8B44C', stroke: '#04070C', 'stroke-width': 0.8 }, mmSvg);
  const mmRead = document.getElementById('mm-read');
  const compassG = document.getElementById('compass-g');
  let mmState = '';
  mmSvg.addEventListener('click', (e) => {
    const r = mmSvg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * TW - TW / 2;
    const z = ((e.clientY - r.top) / r.height) * TH - TH / 2;
    const g = { tx: clamp(x, -TW / 2, TW / 2), tz: clamp(z, -TH / 2, TH / 2), dist: Math.min(orbit.dist, 30), pitch: Math.max(orbit.pitch, 0.55) };
    if (isFull() || mmState === 'dock') flyTo(g);
    else openFullMap({ goal: g });
  });
  document.getElementById('mm-compass').addEventListener('click', () => flyTo({ yaw: 0 }));

  const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  let lastRead = '';
  function readout(x, z) {
    let ns = null;
    let nd = 3.2;
    for (const s of SITES) {
      const v = siteAnchor[s.id];
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < nd) {
        nd = d;
        ns = s;
      }
    }
    if (ns) return 'OVER ' + ns.label;
    let best = null;
    let bd = 1e9;
    for (const c of CITIES) {
      const v = cityV.get(c.name);
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    const mi = bd * MI_PER_UNIT;
    if (mi < 2) return 'OVER ' + best.name.toUpperCase();
    const bv = cityV.get(best.name);
    const brg = ((Math.atan2(x - bv.x, -(z - bv.z)) * 180) / Math.PI + 360) % 360;
    return Math.round(mi) + ' MI ' + DIRS[Math.round(brg / 45) % 8] + ' OF ' + best.name.toUpperCase();
  }
  const fmLayer = document.getElementById('fullmap');
  const dockSlot = document.getElementById('atlas-window');
  function placeMinimap(st) {
    if (st === mmState) return;
    mmState = st;
    const parent = st === 'dock' ? dockSlot : st === 'full' ? fmLayer : document.body;
    if (mm.parentNode !== parent) parent.appendChild(mm);
    mm.className = st;
  }

  // --- full map mode ---
  let savedScroll = 0;
  const inspHome = { parent: insp.parentNode, next: insp.nextSibling };
  function syncURL() {
    const q = new URLSearchParams();
    if (isFull()) q.set('view', 'map');
    const { org, site } = selection();
    const id = org || site;
    if (id) q.set('site', id);
    const s = q.toString();
    try {
      history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + (isFull() ? '' : location.hash));
    } catch (e) {
      /* file:// in some browsers */
    }
  }
  function openFullMap(opts = {}) {
    if (!isFull()) {
      savedScroll = window.scrollY;
      document.documentElement.classList.add('fm-lock');
      document.body.classList.add('fullmap');
      fmLayer.setAttribute('aria-hidden', 'false');
      insp.classList.remove('open');
      fmLayer.appendChild(insp);
      placeMinimap('full');
    }
    setChip(null);
    if (opts.site && siteById[opts.site]) {
      showSiteRoster(opts.site);
      flyTo(presetGoal(opts.site));
      setChip(opts.site);
    } else if (opts.org && nodeById[opts.org]) {
      selectOrg(opts.org);
      flyTo(presetGoal(nodeById[opts.org].siteId));
    } else if (opts.goal) flyTo(opts.goal);
    else if (!opts.keep) {
      flyTo(regionGoal());
      setChip('region');
    }
    syncURL();
    document.getElementById('fm-exit')?.focus({ preventScroll: true });
  }
  function closeFullMap() {
    if (!isFull()) return;
    document.body.classList.remove('fullmap');
    document.documentElement.classList.remove('fm-lock');
    fmLayer.setAttribute('aria-hidden', 'true');
    insp.classList.remove('open');
    inspHome.parent.insertBefore(insp, inspHome.next && inspHome.next.parentNode === inspHome.parent ? inspHome.next : null);
    mmState = '';
    window.scrollTo({ top: savedScroll, behavior: 'instant' });
    syncURL();
  }
  document.getElementById('fm-exit').addEventListener('click', closeFullMap);
  document.addEventListener('keydown', (e) => {
    if (!isFull()) return;
    const step = 60;
    const base = { yaw: orbit.yaw, tx: orbit.tx, tz: orbit.tz };
    if (e.key === 'ArrowLeft') { goal = null; panBy(step, 0, base); }
    else if (e.key === 'ArrowRight') { goal = null; panBy(-step, 0, base); }
    else if (e.key === 'ArrowUp') { goal = null; panBy(0, step, base); }
    else if (e.key === 'ArrowDown') { goal = null; panBy(0, -step, base); }
    else if (e.key === '+' || e.key === '=') flyTo({ dist: clamp(orbit.dist * 0.7, 6, 170) });
    else if (e.key === '-' || e.key === '_') flyTo({ dist: clamp(orbit.dist * 1.42, 6, 170) });
    else if (e.key === '0' || e.key === 'r' || e.key === 'R') flyTo(regionGoal());
    else if (e.key === 'n' || e.key === 'N') flyTo({ yaw: 0 });
    else return;
    e.preventDefault();
  });

  // --- sizing / render loop ---
  let hiT = 0;
  function size() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.updateProjectionMatrix();
  }
  size();
  window.addEventListener('resize', size);
  let running = true;
  document.addEventListener('visibilitychange', () => (running = !document.hidden));
  let booted = false;
  const t0 = performance.now();
  let lastNow = t0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) {
      lastNow = now;
      return;
    }
    const t = (now - t0) / 1000;
    const dt = Math.min(0.12, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;
    // time-based easing: the same feel at 60 fps or 6 fps
    const kFly = reduced ? 1 : 1 - Math.exp(-dt * 5.4);
    const kBlend = reduced ? 1 : 1 - Math.exp(-dt * 4.4);
    const full = isFull();
    const p = storyProgress();
    const inAtlas = atlasInView();
    blend += ((full || inAtlas ? 1 : 0) - blend) * kBlend;

    if (goal) {
      for (const key of ['tx', 'tz', 'dist', 'pitch']) if (goal[key] != null) orbit[key] += (goal[key] - orbit[key]) * kFly;
      let dyaw = 0;
      if (goal.yaw != null) {
        dyaw = Math.atan2(Math.sin(goal.yaw - orbit.yaw), Math.cos(goal.yaw - orbit.yaw));
        orbit.yaw += dyaw * kFly;
      }
      const done =
        ['tx', 'tz', 'pitch'].every((key) => goal[key] == null || Math.abs(goal[key] - orbit[key]) < 0.02) &&
        (goal.dist == null || Math.abs(goal.dist - orbit.dist) < 0.02 * orbit.dist) &&
        Math.abs(dyaw) < 0.004;
      if (done) goal = null;
    }

    if (reduced && !full && !inAtlas) {
      tmpP.set(0, 46, 74);
      tmpT.set(0, 0, -4);
    } else {
      const sp = Math.min(0.999, p);
      posCurve.getPoint(sp, tmpP);
      tgtCurve.getPoint(sp, tmpT);
    }
    orbitCam(oP);
    oT.set(orbit.tx, 2.6 * Math.min(1, 21 / orbit.dist), orbit.tz);
    cam.position.lerpVectors(tmpP, oP, blend);
    look.lerpVectors(tmpT, oT, blend);
    cam.lookAt(look);
    scene.fog.density = Math.min(0.0105, 0.75 / (cam.position.distanceTo(look) * 1.5 + 20));

    if (!reduced) {
      const ph = (t % 6) / 6;
      sweep.scale.set(0.5 + ph * 34, 1, 0.5 + ph * 34);
      sweepMat.opacity = 0.5 * (1 - ph);
      points.rotation.y = t * 0.01;
    } else sweepMat.opacity = 0;
    const hs = (performance.now() - hiT) / 1000;
    highlightRing.material.opacity = hs < 3 ? 0.65 * (1 - hs / 3) * (0.6 + 0.4 * Math.sin(t * 6)) : 0;

    // labels: project, distance-gate, clip, priority declutter
    const VW = window.innerWidth;
    const VH = window.innerHeight;
    const showLbl = full || blend > 0.35 || p > 0.03;
    const placed = [];
    let clip = null;
    if (!full && inAtlas) {
      const wr = dockSlot.getBoundingClientRect();
      clip = [wr.left + 4, wr.top + 40, wr.right - 4, wr.bottom - 30];
    }
    for (const L of labels) {
      let on = showLbl && layerOn(L.kind);
      let sx = 0;
      let sy = 0;
      if (on && cam.position.distanceTo(L.v) > L.maxDist) on = false;
      if (on) {
        pv.copy(L.v).project(cam);
        on = pv.z < 1 && pv.z > -1;
        sx = (pv.x * 0.5 + 0.5) * VW;
        sy = (-pv.y * 0.5 + 0.5) * VH;
      }
      if (on && (sx < -120 || sx > VW + 120 || sy < -60 || sy > VH + 60)) on = false;
      if (on && L.kind !== 'site' && L.w && (sx - L.w / 2 < 6 || sx + L.w / 2 > VW - 6)) on = false;
      if (on) {
        if (!L.w) {
          L.w = L.el.offsetWidth || 80;
          L.h = L.el.offsetHeight || 16;
        }
        let r = [sx - L.w / 2 - 3, sy - L.h * L.ay - 2, sx + L.w / 2 + 3, sy - L.h * L.ay + L.h + 2];
        const hit = () => placed.some((q) => !(r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3]));
        if (L.kind === 'site') {
          let g = 0;
          while (hit() && g++ < 6) {
            sy -= L.h + 4;
            r = [r[0], r[1] - L.h - 4, r[2], r[3] - L.h - 4];
          }
        } else if (hit()) on = false;
        if (on && clip && (r[0] < clip[0] || r[2] > clip[2] || r[1] < clip[1] || r[3] > clip[3])) on = false;
        if (on) {
          placed.push(r);
          L.el.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px) translate(-50%,' + -L.ay * 100 + '%)';
        }
      }
      if (L.on !== on) {
        L.el.classList.toggle('on', on);
        L.on = on;
      }
    }

    // locator
    placeMinimap(full ? 'full' : inAtlas ? 'dock' : story.getBoundingClientRect().bottom > VH * 0.35 ? 'float' : 'hide');
    if (mmState !== 'hide') {
      const c = toMM(cam.position.x, cam.position.z);
      const lk = toMM(look.x, look.z);
      const head = Math.atan2(look.x - cam.position.x, -(look.z - cam.position.z));
      const half = Math.min(0.9, Math.atan(Math.tan((26 * Math.PI) / 180) * cam.aspect));
      const len = clamp(Math.hypot(lk[0] - c[0], lk[1] - c[1]) * 1.7, 14, 170);
      const a1 = head - half;
      const a2 = head + half;
      wedge.setAttribute('points', c[0] + ',' + c[1] + ' ' + (c[0] + Math.sin(a1) * len) + ',' + (c[1] - Math.cos(a1) * len) + ' ' + (c[0] + Math.sin(a2) * len) + ',' + (c[1] - Math.cos(a2) * len));
      camDot.setAttribute('cx', clamp(c[0], 2, MW - 2));
      camDot.setAttribute('cy', clamp(c[1], 2, MH - 2));
      compassG.setAttribute('transform', 'rotate(' + ((-head * 180) / Math.PI).toFixed(1) + ')');
      const rd = readout(look.x, look.z);
      if (rd !== lastRead) {
        lastRead = rd;
        mmRead.textContent = rd;
      }
    }

    renderer.render(scene, cam);
    if (!booted) {
      booted = true;
      canvas.classList.add('live');
      boot.classList.add('done');
    }
  }
  requestAnimationFrame(frame);

  const api = {
    open: openFullMap,
    close: closeFullMap,
    syncURL,
    highlightSite(id) {
      const v = siteAnchor[id];
      if (!v) return;
      highlightRing.position.set(v.x, 0.12, v.z);
      hiT = performance.now();
    },
  };
  registerMap(api);
  // Test/automation hook (used by the smoke test): camera settled, and a site's screen position.
  window.__atlas = {
    ...api,
    settled: () => goal === null,
    screenOf(id) {
      const v = siteAnchor[id];
      if (!v) return null;
      pv.set(v.x, 1.3, v.z).project(cam);
      return { x: (pv.x * 0.5 + 0.5) * window.innerWidth, y: (-pv.y * 0.5 + 0.5) * window.innerHeight };
    },
  };

  // ?view=map[&site=...]
  const q = new URLSearchParams(location.search);
  if (q.get('view') === 'map') {
    const s = q.get('site');
    if (s && siteById[s]) openFullMap({ site: s });
    else if (s && nodeById[s]) openFullMap({ org: s });
    else openFullMap({});
  }
}
