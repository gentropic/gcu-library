// build-gcudat.mjs — package a prepared book dir into a .gcudat data-pack.
//
// A .gcudat is GCU's inert-data counterpart to the executable .gcupkg: a
// container ({ manifest + file tree }) of pure, non-executable data, routed
// by a `kind` discriminator. It's container-agnostic — the manifest
// (gcudat.json) is the discriminator, so a directory, a .zip, or a .tgz that
// carries it are all valid. This producer emits the .tgz form; the consumer
// (@gcu/archive) reads whichever container it gets.
//
// We also write gcudat.json INTO the book dir, so the directory itself is a
// valid directory-form gcudat (loadable without packing).
//
// Usage: node tools/build-gcudat.mjs <slug>   (e.g. ods)

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const slug = process.argv[2];
if (!slug) { console.error('usage: node tools/build-gcudat.mjs <slug>'); process.exit(1); }

const distDir = path.resolve(here, '../dist');

// Locate the source dir across content roots and pick its kind by index file:
//   books/<slug>/book.json    → kind=books  (reader content)
//   data/<slug>/dataset.json  → kind=data   (datasets; std.data)
// build-registry.mjs scans all roots, so adding a kind is just a new root here.
const KINDS = [
  { root: 'books', index: 'book.json',    kind: 'books' },
  { root: 'data',  index: 'dataset.json', kind: 'data' },
];
let src = null;
for (const k of KINDS) {
  const dir = path.resolve(here, '..', k.root, slug);
  if (fs.existsSync(path.join(dir, k.index))) { src = { ...k, dir }; break; }
}
if (!src) {
  console.error('no source for "' + slug + '" — expected books/<slug>/book.json or data/<slug>/dataset.json');
  process.exit(1);
}

const bookDir = src.dir;   // (name kept; it's the pack source dir for any kind)
const meta = JSON.parse(fs.readFileSync(path.join(bookDir, src.index), 'utf8'));

// The gcudat manifest: version key (the sniff target) + kind (the router) +
// metadata + the kind-specific entry pointer. No code, ever.
const manifest = {
  gcudat: 1,
  kind: src.kind,
  name: meta.slug || meta.name || slug,
  title: meta.title || slug,
  version: meta.version || '1.0.0',   // self-describing: the pack carries its own version
  license: meta.license || '',
  attribution: meta.author || meta.attribution || '',
  index: src.index,
};
// optional discovery metadata → flows into the registry entry (build-registry reads these)
if (meta.description) manifest.description = meta.description;
if (Array.isArray(meta.tags)) manifest.tags = meta.tags;
if (meta.extends) manifest.extends = meta.extends;   // expansion tier → base pack
fs.writeFileSync(path.join(bookDir, 'gcudat.json'), JSON.stringify(manifest, null, 2) + '\n');

fs.mkdirSync(distDir, { recursive: true });
const out = path.join(distDir, slug + '.gcudat');
// tar the dir CONTENTS (gcudat.json + book.json + CREDITS + chapters/) so the
// manifest sits at the pack root. gzip for the html payload.
// --force-local: GNU tar (msys/git on Windows) otherwise reads the C: in an
// absolute path as a remote host. Forward-slash the paths for good measure.
// A .gcudat is inert *content* — keep per-book tooling out of it: helper scripts
// (*.mjs) and their previews (.preview/) are excluded by default, plus anything in
// book.json's optional `packIgnore` (so a regenerator can live beside its book).
const fwd = (p) => p.replace(/\\/g, '/');
const ignore = ['*.mjs', '.preview', ...(Array.isArray(meta.packIgnore) ? meta.packIgnore : [])];
const exArgs = ignore.map((p) => '--exclude=' + p);
execFileSync('tar', ['--force-local', ...exArgs, '-czf', fwd(out), '-C', fwd(bookDir), '.'], { stdio: 'inherit' });

const kb = (fs.statSync(out).size / 1024).toFixed(0);
const detail = src.kind === 'books' ? `${(meta.chapters || []).length} chapters`
  : src.kind === 'data' ? (meta.count != null ? `${meta.count} records`
    : meta.assets ? `${Object.values(meta.assets).reduce((a, b) => a + b, 0)} assets` : '? records')
  : '';
console.log(`Built ${path.relative(path.resolve(here, '..'), out)} (${kb} KB) — kind=${manifest.kind}, ${detail}`);
