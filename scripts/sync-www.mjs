// Copies the web app (which lives at the repo root, exactly as Vercel serves it)
// into www/ — Capacitor's webDir. This is the wrapper's only "build step"; the
// web app itself stays plain files with no bundler. Run via `npm run sync`.
//
// sw.js is deliberately EXCLUDED: inside the native wrapper the assets are
// bundled locally and app.js skips SW registration on native, so shipping a
// service worker into www/ would only risk serving stale copies.

import { cp, rm, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');

// Files and directories that make up the deployed web app.
const ASSETS = [
  'index.html',
  'app.js',
  'style.css',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'fonts'
];

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function main() {
  await rm(www, { recursive: true, force: true });
  await mkdir(www, { recursive: true });
  for (const asset of ASSETS) {
    const src = join(root, asset);
    if (!(await exists(src))) {
      console.warn(`sync-www: skipping missing asset "${asset}"`);
      continue;
    }
    await cp(src, join(www, asset), { recursive: true });
  }
  console.log(`sync-www: copied ${ASSETS.length} assets into www/`);
}

main().catch(err => {
  console.error('sync-www failed:', err);
  process.exit(1);
});
