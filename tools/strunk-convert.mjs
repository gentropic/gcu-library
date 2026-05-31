// strunk-convert.mjs — convert "The Elements of Style" (William Strunk Jr.,
// 1918, US public domain) from Project Gutenberg #37134 into a gcu-library book.
// Then: node tools/build-gcudat.mjs elements-of-style && node tools/build-registry.mjs
//       && node tools/build-catalog.mjs
//
// Chapters are kept as HTML (the reader sanitizes + renders), preserving the
// italic examples + rule structure. The Strunk-ONLY 1918 edition is public
// domain; the later Strunk & White revision is NOT — this is the original.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'https://www.gutenberg.org/files/37134/37134-h/37134-h.htm';

let html = (await (await fetch(SOURCE)).text()).replace(/\r\n/g, '\n');

// Trim to the PG content (between the START / END markers), else fall back to <body>.
const start = html.search(/\*\*\*\s*START OF TH[EI][\s\S]*?\*\*\*/i);
const end = html.search(/\*\*\*\s*END OF TH[EI][\s\S]*?\*\*\*/i);
if (start >= 0) html = html.slice(html.indexOf('***', start) + 3, end >= 0 ? end : undefined);
// also drop a trailing "End of the Project Gutenberg EBook…" line if present
html = html.replace(/End of (the )?Project Gutenberg[\s\S]*$/i, '');

// Clean PG cruft: page-number spans, and unwrap anchors (keep their text).
const clean = (s) => s
  .replace(/<span class="pagenum">[\s\S]*?<\/span>/gi, '')
  .replace(/<a\b[^>]*>/gi, '').replace(/<\/a>/gi, '')
  .replace(/\n{3,}/g, '\n\n').trim();
const textOf = (h) => h.replace(/<[^>]+>/g, '').replace(/&mdash;/g, '—').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// Split on <h2> section boundaries; each section becomes a chapter. Drop the
// pre-h2 preamble (title page) and the CONTENTS section.
const parts = html.split(/(?=<h2[^>]*>)/i).filter((p) => /^<h2/i.test(p.trim()));
const chapters = [];
for (const part of parts) {
  const title = textOf((part.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || [, ''])[1]);
  if (!title || /^contents$/i.test(title)) continue;
  chapters.push({ title, html: clean(part) });
}

const slug = 'elements-of-style';
const outDir = path.resolve(here, '../books', slug);
const chapDir = path.join(outDir, 'chapters');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(chapDir, { recursive: true });

const bookChapters = [];
chapters.forEach((c, i) => {
  const stem = c.title.toLowerCase().replace(/^[ivx]+\.\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'ch';
  const fn = String(i + 1).padStart(2, '0') + '-' + stem + '.html';
  fs.writeFileSync(path.join(chapDir, fn), c.html + '\n');
  bookChapters.push({ id: 'c' + (i + 1), title: c.title, file: 'chapters/' + fn, format: 'html' });
});

fs.writeFileSync(path.join(outDir, 'book.json'), JSON.stringify({
  title: 'The Elements of Style', author: 'William Strunk Jr.', lang: 'en', slug,
  version: '1.0.0', license: 'Public Domain',
  description: 'The classic concise guide to English usage and composition (1918, original Strunk edition).',
  tags: ['reference', 'style', 'writing', 'english'],
  source: 'https://www.gutenberg.org/ebooks/37134', chapters: bookChapters,
}, null, 2) + '\n');

fs.writeFileSync(path.join(outDir, 'CREDITS.md'),
  '# The Elements of Style — credits\n\n'
  + '**William Strunk Jr.**, *The Elements of Style* (1918, "Strunk-only" first edition).\n\n'
  + 'Public domain in the United States (published 1918, well before the 1929 cutoff).\n'
  + 'Source: Project Gutenberg eBook #37134 (https://www.gutenberg.org/ebooks/37134).\n\n'
  + 'NOTE: this is the ORIGINAL 1918 edition by William Strunk Jr. alone. The later\n'
  + '"Strunk & White" revision (E. B. White, 1959+) is still under copyright and is NOT\n'
  + 'included here. Format conversion (Gutenberg HTML → book chapters) is not a\n'
  + 'modification of the work.\n');

console.log('wrote', chapters.length, 'chapters →', path.relative(path.resolve(here, '..'), outDir));
for (const c of bookChapters) console.log('  ', c.title);
