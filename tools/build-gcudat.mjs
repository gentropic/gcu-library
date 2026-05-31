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

const bookDir = path.resolve(here, '../books', slug);
const distDir = path.resolve(here, '../dist');
const bookJsonPath = path.join(bookDir, 'book.json');
if (!fs.existsSync(bookJsonPath)) { console.error('no book.json at', bookDir); process.exit(1); }

const book = JSON.parse(fs.readFileSync(bookJsonPath, 'utf8'));

// The gcudat manifest: version key (the sniff target) + kind (the router) +
// metadata + the kind-specific entry pointer. No code, ever.
const manifest = {
  gcudat: 1,
  kind: 'books',
  name: book.slug || slug,
  title: book.title || slug,
  version: book.version || '1.0.0',   // self-describing: the pack carries its own version
  license: book.license || '',
  attribution: book.author || '',
  index: 'book.json',
};
// optional discovery metadata → flows into the registry entry (build-registry reads these)
if (book.description) manifest.description = book.description;
if (Array.isArray(book.tags)) manifest.tags = book.tags;
fs.writeFileSync(path.join(bookDir, 'gcudat.json'), JSON.stringify(manifest, null, 2) + '\n');

fs.mkdirSync(distDir, { recursive: true });
const out = path.join(distDir, slug + '.gcudat');
// tar the dir CONTENTS (gcudat.json + book.json + CREDITS + chapters/) so the
// manifest sits at the pack root. gzip for the html payload.
// --force-local: GNU tar (msys/git on Windows) otherwise reads the C: in an
// absolute path as a remote host. Forward-slash the paths for good measure.
const fwd = (p) => p.replace(/\\/g, '/');
execFileSync('tar', ['--force-local', '-czf', fwd(out), '-C', fwd(bookDir), '.'], { stdio: 'inherit' });

const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`Built ${path.relative(path.resolve(here, '..'), out)} (${kb} KB) — kind=${manifest.kind}, ${book.chapters.length} chapters`);
