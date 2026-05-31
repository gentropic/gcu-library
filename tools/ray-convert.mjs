// ray-convert.mjs — convert "Ray Tracing in One Weekend" (Markdeep, CC0) into a
// gcu-library book (books/rtow/{book.json, chapters/*.md}). Then:
//   node tools/build-gcudat.mjs rtow   &&   node tools/build-registry.mjs
//
// Source: RayTracing/raytracing.github.io (release branch), CC0 1.0
// (COPYING.txt). The book's markdeep header carries an "All rights reserved"
// author line that the repo-level CC0 supersedes — we redistribute under CC0,
// crediting the authors (courtesy; CC0 doesn't require it).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = 'https://raw.githubusercontent.com/RayTracing/raytracing.github.io/release';
const BOOK_URL = RAW + '/books/RayTracingInOneWeekend.html';
const slug = 'rtow';
const outDir = path.resolve(here, '../books', slug);
const chapDir = path.join(outDir, 'chapters');

console.log('fetching', BOOK_URL);
let body = await (await fetch(BOOK_URL)).text();
body = body.replace(/\r\n/g, '\n');

// 1) markdeep body: drop the head (up to the Markdeep comment) + trailing scripts.
body = body.replace(/^[\s\S]*?<!--\s*Markdeep[\s\S]*?-->/i, '');
body = body.split(/\n<script\b/)[0].trim();

// 2) math: $$…$$ → \[…\] (display), then $…$ → \(…\) (inline). The book is
//    math-heavy; $ is always LaTeX here.
body = body.replace(/\$\$([\s\S]+?)\$\$/g, (_, x) => '\\[' + x + '\\]');
// inline: allow newlines — markdeep inline math can wrap across lines.
body = body.replace(/\$([^$]+?)\$/g, (_, x) => '\\(' + x + '\\)');

// 3) images: ![<span>Image N:</span> cap](../images/x.png class='…') → fetch + inline.
const jobs = [];
body = body.replace(/!\[([^\]]*)\]\(([^)\s]+)([^)]*)\)/g, (_, alt, url, rest) => {
  const cleanAlt = alt.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const name = url.split('/').pop();
  const ph = '@@IMG' + jobs.length + '@@';
  jobs.push({ name, alt: cleanAlt, ph });
  return ph;
});
for (const j of jobs) {
  try {
    const r = await fetch(RAW + '/images/' + j.name);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    const mime = /\.png$/i.test(j.name) ? 'image/png' : 'image/jpeg';
    body = body.replace(j.ph, '![' + j.alt + '](data:' + mime + ';base64,' + buf.toString('base64') + ')');
    console.log('  inlined', j.name, (buf.length / 1024 | 0) + ' KB');
  } catch (e) { body = body.replace(j.ph, '*(image: ' + j.alt + ')*'); console.warn('  image failed', j.name, e.message); }
}

// 4) split on h1 setext (Title\n====). split() with a capture group yields
//    [frontMatter, title1, body1, title2, body2, …].
const segs = body.split(/^(.+)\n={3,}[ \t]*$/m);
const chapters = [];
for (let i = 1; i < segs.length; i += 2) {
  const title = segs[i].trim();
  let content = (segs[i + 1] || '');
  content = content.replace(/^(.+)\n-{3,}[ \t]*$/gm, (_, t) => '## ' + t.trim());  // setext h2 → ##
  chapters.push({ title, md: '# ' + title + '\n' + content.trim() + '\n' });
}

// 5) front matter → an "About" chapter. Dedent (markdeep centres the title block
//    with leading spaces, which markdown would read as a code block); resolve the
//    reference-style author links to plain text; drop ref-link defs.
let about = segs[0]
  .replace(/^[ \t]+/gm, '')
  .replace(/^\[[^\]]+\]:\s*\S+.*$/gm, '')
  .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
  .replace(/^Copyright[^\n]*$/gm, '')          // vestigial "all rights reserved" — CC0 governs
  .replace(/^\*\*(.+?)\*\*[ \t]*$/m, '# $1')
  .replace(/\n{3,}/g, '\n\n')
  .trim();
about += '\n\n---\n\n*Ray Tracing in One Weekend, by Peter Shirley, Trevor David Black, '
  + 'and Steve Hollasch. Dedicated to the public domain under CC0 1.0. '
  + 'Source: [raytracing.github.io](https://raytracing.github.io).*\n';

// 6) write the book.
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(chapDir, { recursive: true });
const all = [{ title: 'About', md: about }, ...chapters];
const bookChapters = [];
all.forEach((c, i) => {
  const stem = c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'ch';
  const fn = String(i + 1).padStart(2, '0') + '-' + stem + '.md';
  fs.writeFileSync(path.join(chapDir, fn), c.md);
  bookChapters.push({ id: 'c' + (i + 1), title: c.title, file: 'chapters/' + fn, format: 'md' });
});
const book = {
  title: 'Ray Tracing in One Weekend',
  author: 'Peter Shirley, Trevor David Black, Steve Hollasch',
  lang: 'en', slug, license: 'CC0-1.0',
  source: 'https://raytracing.github.io',
  chapters: bookChapters,
};
fs.writeFileSync(path.join(outDir, 'book.json'), JSON.stringify(book, null, 2) + '\n');
console.log('wrote', all.length, 'chapters →', outDir);
