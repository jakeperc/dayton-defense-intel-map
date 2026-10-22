// Build config.
//
//   npm run build          → dist/        (the site: index.html + hashed assets + data/*.json)
//   npm run build:single   → dist-single/ (one self-contained dayton-defense-intel-map.html, works offline)
//
// The site is built with relative paths (base "./"), so the same dist/ works at
// jakeperc.github.io/dayton-defense-intel-map/, jakepercy.com/dayton-defense-intel-map/, or any other
// folder. Set ATLAS_BASE=/some/path/ to build for a fixed path instead.
import { defineConfig } from 'vite';
import { readFileSync, readdirSync, mkdirSync, copyFileSync, renameSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { viteSingleFile } from 'vite-plugin-singlefile';

const root = import.meta.dirname;
const meta = JSON.parse(readFileSync(join(root, 'data/meta.json'), 'utf8'));
const siteUrl = process.env.ATLAS_SITE_URL || meta.site_url;

/** Fill __SITE_URL__ and add schema.org Dataset metadata, dated from data/meta.json. */
function headMeta() {
  return {
    name: 'atlas-head-meta',
    transformIndexHtml(html) {
      const ld = {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: meta.title,
        description: meta.subtitle + ' — institutions, contractors, money flows and contract vehicles, evidence-graded from public sources.',
        url: siteUrl,
        dateModified: meta.data_refreshed,
        creator: { '@type': 'Person', name: meta.author.name, url: meta.author.url },
        license: 'https://creativecommons.org/licenses/by/4.0/',
        isAccessibleForFree: true,
        spatialCoverage: 'Dayton–Springfield–Cincinnati corridor, Ohio, United States',
        distribution: ['sites', 'network', 'contracts', 'watchlist', 'geography', 'money'].map((n) => ({
          '@type': 'DataDownload',
          encodingFormat: 'application/json',
          contentUrl: new URL(`data/${n}.json`, siteUrl).href,
        })),
      };
      return {
        html: html.replaceAll('__SITE_URL__', siteUrl),
        tags: [{ tag: 'script', attrs: { type: 'application/ld+json' }, children: JSON.stringify(ld), injectTo: 'head' }],
      };
    },
  };
}

/** Publish the raw data next to the page, so the "data/*.json" links on it work. */
function publishData() {
  let outDir = 'dist';
  return {
    name: 'atlas-publish-data',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const dest = join(outDir, 'data');
      mkdirSync(dest, { recursive: true });
      for (const f of readdirSync(join(root, 'data'))) if (f.endsWith('.json')) copyFileSync(join(root, 'data', f), join(dest, f));
    },
  };
}

/** Single-file mode: rename the output so it is obviously the portable copy. */
function renameSingle() {
  let outDir = 'dist-single';
  return {
    name: 'atlas-rename-single',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const from = join(outDir, 'index.html');
      if (existsSync(from)) renameSync(from, join(outDir, 'dayton-defense-intel-map.html'));
    },
  };
}

export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: process.env.ATLAS_BASE || './',
    plugins: single ? [headMeta(), viteSingleFile(), renameSingle()] : [headMeta(), publishData()],
    build: single
      ? { outDir: 'dist-single', emptyOutDir: true, chunkSizeWarningLimit: 2000 }
      : {
          outDir: 'dist',
          emptyOutDir: true,
          target: 'es2020',
          // three.js is ~600 kB; it is already split out and loaded after first paint
          chunkSizeWarningLimit: 800,
          rollupOptions: {
            output: {
              manualChunks: (id) => (id.includes('node_modules/three/') ? 'three' : undefined),
            },
          },
        },
  };
});
