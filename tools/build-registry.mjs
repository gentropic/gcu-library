// build-registry.mjs — generate registry.json at the repo root from the packed
// .gcudat artifacts in dist/, reading each pack's metadata from
// books/<name>/gcudat.json and computing size + SRI over the artifact.
//
// Consumed by Auditable Works' "Browse Library" (and geas `pkg`). See the
// registry spec (auditable: spec_inbox/auditable-registry-spec.md §2).
//
//   node tools/build-registry.mjs

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const booksDir = path.join(root, 'books');

function sri(bytes) {
  return 'sha256-' + crypto.createHash('sha256').update(bytes).digest('base64');
}

// Map each pack's <root>/<name>/gcudat.json by its `name` for metadata lookup.
// Kind-agnostic: scan every top-level content root (books/, and future
// datasets/, manuals/, … — anything that isn't tooling/build output), so new
// kinds register with no change here. The gcudat.json itself names its kind.
const SKIP_ROOTS = new Set(['dist', 'tools', 'covers', '.cache', '.git', 'node_modules']);
const meta = {};
for (const rootEntry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!rootEntry.isDirectory() || SKIP_ROOTS.has(rootEntry.name)) continue;
  const rootDir = path.join(root, rootEntry.name);
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const gj = path.join(rootDir, entry.name, 'gcudat.json');
    if (!fs.existsSync(gj)) continue;
    try {
      const g = JSON.parse(fs.readFileSync(gj, 'utf8'));
      if (g && g.name) meta[g.name] = g;
    } catch (e) { console.warn('skip', gj, e.message); }
  }
}

const entries = [];
for (const file of fs.readdirSync(distDir)) {
  if (!file.endsWith('.gcudat')) continue;
  const name = file.replace(/\.gcudat$/, '');
  const bytes = fs.readFileSync(path.join(distDir, file));
  const g = meta[name] || {};
  const entry = {
    name,
    kind: 'gcudat',
    datKind: g.kind || 'data',
    title: g.title || name,
    description: g.description || '',
    version: g.version || '1.0.0',
    license: g.license || 'UNKNOWN',
    attribution: g.attribution || '',
    size: bytes.length,
    url: 'dist/' + file,
    integrity: sri(bytes),
    tags: Array.isArray(g.tags) ? g.tags : [g.kind || 'data'],
  };
  if (g.extends) entry.extends = g.extends;   // expansion tier → base pack
  entries.push(entry);
}
entries.sort((a, b) => a.name.localeCompare(b.name));

const registry = {
  registry: 1,
  name: 'GCU Library',
  description: 'Prepared books and data packs from the Geoscientific Chaos Union.',
  homepage: 'https://github.com/gentropic/gcu-library',
  updated: new Date().toISOString().slice(0, 10),
  entries,
};

const out = path.join(root, 'registry.json');
fs.writeFileSync(out, JSON.stringify(registry, null, 2) + '\n');
console.log('Wrote registry.json — ' + entries.length + ' entries:');
for (const e of entries) console.log('  ' + e.name + ' (' + e.datKind + ', ' + (e.size / 1024 / 1024).toFixed(2) + ' MB) ' + e.integrity.slice(0, 22) + '…');
