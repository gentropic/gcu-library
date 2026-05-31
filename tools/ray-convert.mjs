// ray-convert.mjs — convert the "Ray Tracing in One Weekend" series (Markdeep,
// CC0) into gcu-library books. Then:
//   for b in rtow rtnw rtrol; do node tools/build-gcudat.mjs $b; done
//   node tools/build-registry.mjs
//
// Source: RayTracing/raytracing.github.io (release), CC0 1.0 (COPYING.txt). The
// markdeep "all rights reserved" author line is vestigial — stripped here.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = 'https://raw.githubusercontent.com/RayTracing/raytracing.github.io/release';
const AUTHOR = 'Peter Shirley, Trevor David Black, Steve Hollasch';
const BOOKS = [
  { slug: 'rtow', file: 'RayTracingInOneWeekend.html', title: 'Ray Tracing in One Weekend' },
  { slug: 'rtnw', file: 'RayTracingTheNextWeek.html', title: 'Ray Tracing: The Next Week' },
  { slug: 'rtrol', file: 'RayTracingTheRestOfYourLife.html', title: 'Ray Tracing: The Rest of Your Life' },
];

// Strip the minimum common indent across non-blank lines (preserves nesting).
function dedent(code) {
  const lines = code.replace(/\t/g, '    ').replace(/\s+$/, '').split('\n');
  let min = Infinity;
  for (const l of lines) { if (!l.trim()) continue; const n = l.match(/^ */)[0].length; if (n < min) min = n; }
  if (!isFinite(min)) min = 0;
  return lines.map((l) => l.slice(min)).join('\n');
}
// Markdeep lang → a \w-safe fence info string (renderMd's lang capture is \w*).
function langOf(s) {
  const l = s.trim().replace(/\bhighlight\b/ig, '').trim();
  if (/c\+\+/i.test(l)) return 'cpp';
  return l.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

async function convert(b) {
  console.log('\n=== ' + b.title + ' ===');
  let body = (await (await fetch(RAW + '/books/' + b.file)).text()).replace(/\r\n/g, '\n');
  // markdeep body: drop head (to the Markdeep comment); drop ONLY the trailing
  // markdeep loader scripts (`<script src=…>` onward); UNWRAP mid-document
  // `<script type="preformatted">…</script>` blocks (markdeep uses these to
  // shield long code listings from the HTML parser — their inner ~~~~ fence is
  // real content, NOT to be dropped). Splitting on the first <script truncated
  // the book at the first such listing.
  body = body.replace(/^[\s\S]*?<!--\s*Markdeep[\s\S]*?-->/i, '');
  body = body.replace(/\n<script\s+src=[\s\S]*$/i, '');
  body = body.replace(/<script\s+type=["']preformatted["'][^>]*>\n?/gi, '');
  body = body.replace(/<\/script>/gi, '');
  // strip standalone layout div lines.
  body = body.replace(/^[ \t]*<\/?div[^>]*>[ \t]*$/gm, '').trim();

  // 1) Code fences FIRST (protect from math/setext): ~~~~ <lang> … ~~~~.
  // Markdeep marks added/highlighted lines as CONSECUTIVE fenced segments
  // (`~~~ C++` / `~~~ C++ highlight`, no blank line between) — only the FINAL
  // terminator is a bare `~~~`. So this match spans the whole listing with the
  // internal segment fences captured as content; strip those internal fence
  // lines to collapse the listing into one clean block.
  const code = [];
  body = body.replace(/^[ \t]*~~~+[ \t]*([^\n]*)\n([\s\S]*?)\n[ \t]*~~~+[ \t]*$/gm, (_, lang, src) => {
    const ph = '@@CODE' + code.length + '@@';
    const info = langOf(lang);
    const merged = src.replace(/^[ \t]*~~~+[^\n]*$/gm, '').replace(/\n{3,}/g, '\n\n');
    code.push('```' + info + '\n' + dedent(merged) + '\n```');
    return '\n' + ph + '\n';
  });

  // 2) Images (bracket-safe alt: markdeep ![Figure [id]: cap](images/x.jpg …)).
  const jobs = [];
  body = body.replace(/!\[((?:[^[\]]|\[[^\]]*\])*)\]\(([^)\s]+)([^)]*)\)/g, (_, alt, url) => {
    const cap = alt.replace(/<[^>]+>/g, '').replace(/^(Figure|Image)\s*\[[^\]]*\]:\s*/i, '').replace(/\s+/g, ' ').trim();
    const ph = '@@IMG' + jobs.length + '@@';
    jobs.push({ name: url.split('/').pop(), cap, ph });
    return ph;
  });
  for (const j of jobs) {
    try {
      const r = await fetch(RAW + '/images/' + j.name);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      const mime = /\.png$/i.test(j.name) ? 'image/png' : (/\.svg$/i.test(j.name) ? 'image/svg+xml' : 'image/jpeg');
      body = body.replace(j.ph, '![' + j.cap + '](data:' + mime + ';base64,' + buf.toString('base64') + ')');
    } catch (e) { body = body.replace(j.ph, '*(image: ' + j.cap + ')*'); console.warn('  image failed', j.name, e.message); }
  }
  console.log('  images:', jobs.length, '· code blocks:', code.length);

  // 3) Listing captions: [Listing [id]: <kbd>[file]</kbd> caption] → italic.
  body = body.replace(/^[ \t]*\[Listing\s*\[[^\]]*\]:\s*([\s\S]*?)\][ \t]*$/gm, (_, inner) =>
    '\n*Listing — ' + inner.replace(/<[^>]+>/g, '').replace(/\[([^\]]+)\]/g, '$1').replace(/\s+/g, ' ').trim() + '*\n');

  // 4) Math: $$…$$ → \[…\]; $…$ → \(…\) (newline-tolerant for wrapped inline).
  body = body.replace(/\$\$([\s\S]+?)\$\$/g, (_, x) => '\\[' + x + '\\]');
  body = body.replace(/\$([^$]+?)\$/g, (_, x) => '\\(' + x + '\\)');

  // 5) Split on h1 setext (Title\n====).
  const segs = body.split(/^(.+)\n={3,}[ \t]*$/m);
  const chapters = [];
  for (let i = 1; i < segs.length; i += 2) {
    const title = segs[i].trim();
    let content = (segs[i + 1] || '').replace(/^(.+)\n-{3,}[ \t]*$/gm, (_, t) => '## ' + t.trim());
    content = content.replace(/@@CODE(\d+)@@/g, (_, n) => code[+n]);   // reinsert code
    chapters.push({ title, md: '# ' + title + '\n' + content.trim() + '\n' });
  }

  // 6) Front matter → About.
  let about = segs[0]
    .replace(/^[ \t]+/gm, '')
    .replace(/^\[[^\]]+\]:\s*\S+.*$/gm, '')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    .replace(/^Copyright[^\n]*$/gm, '')
    .replace(/^\*\*(.+?)\*\*[ \t]*$/m, '# $1')
    .replace(/@@CODE(\d+)@@/g, (_, n) => code[+n])
    .replace(/\n{3,}/g, '\n\n').trim();
  about += '\n\n---\n\n*' + b.title + ', by ' + AUTHOR + '. Dedicated to the public domain under '
    + 'CC0 1.0. Source: [raytracing.github.io](https://raytracing.github.io).*\n';

  // 7) Write.
  const outDir = path.resolve(here, '../books', b.slug);
  const chapDir = path.join(outDir, 'chapters');
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
  fs.writeFileSync(path.join(outDir, 'book.json'), JSON.stringify({
    title: b.title, author: AUTHOR, lang: 'en', slug: b.slug, license: 'CC0-1.0',
    source: 'https://raytracing.github.io', chapters: bookChapters,
  }, null, 2) + '\n');
  console.log('  wrote', all.length, 'chapters →', outDir);
}

for (const b of BOOKS) await convert(b);
