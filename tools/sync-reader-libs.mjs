// sync-reader-libs.mjs — vendor the standalone reader's dependencies from the
// auditable repo into reader/lib/. These are all standalone ES modules (zero
// relative imports), so the static read.html can import them directly — no
// build step. Re-run this when the reader engine changes upstream.
//
//   node tools/sync-reader-libs.mjs            # auto-locates ../auditable
//   node tools/sync-reader-libs.mjs <path>     # explicit auditable repo path

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const aud = path.resolve(process.argv[2] || path.join(root, '..', 'auditable'));
if (!fs.existsSync(path.join(aud, 'ext', 'reader-core', 'index.js'))) {
  console.error('sync-reader-libs: no auditable repo at', aud, '\n  pass its path: node tools/sync-reader-libs.mjs <path-to-auditable>');
  process.exit(1);
}

// upstream → vendored name. All standalone ESM (verified: zero relative imports).
const FILES = [
  ['ext/reader-core/index.js', 'reader-core.js'],
  ['ext/docview/index.js',     'docview.js'],
  ['ext/librarian/index.js',   'librarian.js'],
  ['ext/katex/index.js',       'katex.js'],
  ['src/js/markdown.js',       'markdown.js'],
];

const libDir = path.join(root, 'reader', 'lib');
fs.mkdirSync(libDir, { recursive: true });
const banner = '// VENDORED from the auditable repo — do not edit here.\n'
  + '// Regenerate: node tools/sync-reader-libs.mjs\n';
for (const [src, dest] of FILES) {
  const body = fs.readFileSync(path.join(aud, src), 'utf8');
  fs.writeFileSync(path.join(libDir, dest), banner + body);
  console.log('vendored', dest, '(' + (body.length / 1024).toFixed(0) + ' KB)');
}
console.log('→ reader/lib/ synced from', path.relative(root, aud) || aud);
