#!/usr/bin/env node
// Sanity-checks a finished build in dist/ (no browser needed). Run by CI after
// `vite build`: every file the page references exists, the data is published
// beside it, and no build placeholder survived.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const problems = [];
const fail = (m) => problems.push(m);

const indexPath = join(dist, 'index.html');
if (!existsSync(indexPath)) {
  console.error('✗ dist/index.html is missing — run `npm run build` first.');
  process.exit(1);
}
const html = readFileSync(indexPath, 'utf8');

if (html.includes('__SITE_URL__')) fail('index.html still contains the __SITE_URL__ placeholder');
if (!html.includes('application/ld+json')) fail('index.html has no JSON-LD dataset block');

// local files referenced by src= / href= (skip absolute URLs, anchors, data: URIs)
const refs = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !/^(?:[a-z]+:|#|\/\/)/i.test(u));
for (const ref of refs) {
  const clean = ref.split(/[?#]/)[0].replace(/^\.\//, '');
  if (clean && !existsSync(join(dist, clean))) fail(`index.html references ${ref}, which is not in dist/`);
}

const assets = existsSync(join(dist, 'assets')) ? readdirSync(join(dist, 'assets')) : [];
if (!assets.some((f) => /^three-.*\.js$/.test(f))) fail('no three-*.js chunk in dist/assets (the 3D layer was not split out)');
if (!assets.some((f) => /^atlas-.*\.js$/.test(f))) fail('no atlas-*.js chunk in dist/assets');
// files referenced from inside the CSS/JS bundles (fonts, lazy chunks)
for (const f of assets.filter((a) => /\.(?:css|js)$/.test(a))) {
  const body = readFileSync(join(dist, 'assets', f), 'utf8');
  for (const m of body.matchAll(/(?:\.\/|\/assets\/|url\()([\w.-]+\.(?:woff2?|js|css))/g)) {
    if (!assets.includes(m[1])) fail(`assets/${f} references ${m[1]}, which is not in dist/assets`);
  }
}

const data = ['sites', 'network', 'contracts', 'watchlist', 'geography', 'money', 'meta'];
for (const n of data) {
  const p = join(dist, 'data', `${n}.json`);
  if (!existsSync(p)) fail(`dist/data/${n}.json is missing`);
  else {
    try {
      JSON.parse(readFileSync(p, 'utf8'));
    } catch (e) {
      fail(`dist/data/${n}.json is not valid JSON`);
    }
  }
}

if (problems.length) {
  for (const p of problems) console.error('  error ' + p);
  console.error(`\n✗ ${problems.length} problem${problems.length > 1 ? 's' : ''} in dist/.`);
  process.exit(1);
}
console.log(`✓ dist ok — ${refs.length} local references, ${assets.length} assets, ${data.length} data files`);
