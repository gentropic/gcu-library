// build-catalog.mjs — generate the GitHub Pages landing page (index.html) from
// registry.json: a browsable shelf of the library's content. Each book links
// to the standalone reader (read.html?book=<name>). Pure static, served from
// the repo root by GitHub Pages.
//
//   node tools/build-catalog.mjs
//
// Regenerate after build-registry.mjs (the catalog reads registry.json).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reg = JSON.parse(fs.readFileSync(path.join(root, 'registry.json'), 'utf8'));
const SOURCE_URL = 'https://raw.githubusercontent.com/gentropic/gcu-library/main/registry.json';
const WORKS_URL = 'https://gentropic.org/works/';   // the published Auditable Works PWA

// "Open in Works" deep-links are capsule registry-pointers (QR / share form).
// Encoded at build time via @gcu/capsule from the sibling auditable repo; if
// it's not present (e.g. CI without the sibling), the buttons are skipped.
let capsule = null;
try { capsule = await import('../../auditable/ext/capsule/index.js'); }
catch { console.warn('  (no ../auditable/ext/capsule — "Open in Works" links skipped)'); }
async function worksLink(name) {
  if (!capsule) return null;
  const cap = await capsule.encodeInlineI(JSON.stringify({ v: 1, install: { source: SOURCE_URL, name } }));
  return WORKS_URL + '#capsule=' + encodeURIComponent(capsule.fragmentEncode(cap));
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isNC = (l) => /\bNC\b|non-?commercial/i.test(String(l || ''));
const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const ICON = { books: '▤', geodata: '◴', data: '◳' };

const card = (e, worksHref) => {
  const readable = e.kind === 'gcudat' && (e.datKind === 'books' || !e.datKind);
  const cover = e.cover
    ? `<img src="${esc(/^https?:/.test(e.cover) ? e.cover : e.cover)}" alt="">`
    : (ICON[e.datKind] || ICON.data);
  return `<article class="card">
    <div class="cover">${cover}</div>
    <div class="body">
      <h2>${esc(e.title || e.name)}</h2>
      <div class="badges"><span class="badge">${esc(e.kind === 'gcupkg' ? 'ext' : (e.datKind || 'data'))}</span>${isNC(e.license) ? '<span class="badge nc" title="Non-commercial — free to share, not to sell">NC</span>' : ''}</div>
      <div class="meta">${esc(e.license || '')}${e.attribution ? ' · ' + esc(e.attribution) : ''} · ${fmtSize(e.size || 0)}${e.version ? ' · v' + esc(e.version) : ''}</div>
      ${e.description ? `<p class="desc">${esc(e.description)}</p>` : ''}
      ${e.tags && e.tags.length ? `<div class="tags">${e.tags.map((t) => '#' + esc(t)).join(' ')}</div>` : ''}
      <div class="act">
        ${readable ? `<a class="read" href="read.html?book=${encodeURIComponent(e.name)}">Read ▸</a>` : ''}
        ${worksHref ? `<a class="works" href="${esc(worksHref)}" title="Install into Auditable Works">Open in Works ▸</a>` : ''}
        <a class="dl" href="${esc(e.url)}" download>Download</a>
      </div>
    </div>
  </article>`;
};

// pre-encode the per-entry capsule deep-links (async)
const works = {};
for (const e of reg.entries) works[e.name] = await worksLink(e.name);

const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(reg.name || 'GCU Library')}</title>
<style>
  :root {
    --bg:#15191c; --surface:#1b2024; --raised:#222a2f; --bright:#2a343a;
    --border:#33414a; --fg:#e6edf0; --soft:#8aa0ab; --muted:#b9c7cf;
    --action:#e07b39; --go:#5bb98c; --warn:#d9a441;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg);
    font:15px/1.6 'Barlow',system-ui,-apple-system,sans-serif; }
  * { scrollbar-width:thin; scrollbar-color:var(--border) transparent; }
  *::-webkit-scrollbar { width:10px; height:10px; }
  *::-webkit-scrollbar-thumb { background:var(--border); border-radius:5px; border:2px solid var(--bg); }
  *::-webkit-scrollbar-thumb:hover { background:var(--bright); }
  *::-webkit-scrollbar-track { background:transparent; }
  a { color:var(--action); text-decoration:none; }
  a:hover { text-decoration:underline; }
  header { padding:34px 24px 18px; border-bottom:1px solid var(--border); }
  header .wrap { max-width:1040px; margin:0 auto; }
  h1 { margin:0; font:600 26px ui-monospace,'Space Mono',monospace; letter-spacing:2px; }
  header p { margin:6px 0 0; color:var(--soft); }
  main { max-width:1040px; margin:0 auto; padding:22px 24px 40px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:16px; }
  .card { display:flex; gap:14px; padding:15px; border:1px solid var(--border); border-radius:8px; background:var(--raised); }
  .cover { flex:none; width:64px; height:84px; border-radius:4px; background:var(--bright);
    display:grid; place-items:center; color:var(--soft); font-size:30px; overflow:hidden; }
  .cover img { width:100%; height:100%; object-fit:cover; }
  .body { flex:1; min-width:0; display:flex; flex-direction:column; }
  .body h2 { margin:0; font-size:17px; line-height:1.25; }
  .badges { margin:5px 0; }
  .badge { font:10px ui-monospace,monospace; text-transform:uppercase; letter-spacing:.5px;
    color:var(--action); border:1px solid var(--border); border-radius:3px; padding:1px 6px; margin-right:5px; }
  .badge.nc { color:var(--warn); border-color:var(--warn); }
  .meta { color:var(--soft); font-size:12px; }
  .desc { color:var(--muted); font-size:13.5px; margin:7px 0 0;
    overflow:hidden; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; }
  .tags { color:var(--soft); font:11px ui-monospace,monospace; margin-top:6px; }
  .act { margin-top:auto; padding-top:11px; display:flex; gap:14px; align-items:center; }
  .read { font-weight:600; }
  .works { font-weight:600; color:var(--go); }
  .dl { color:var(--soft); font-size:12px; }
  footer { max-width:1040px; margin:0 auto; padding:18px 24px 48px; color:var(--soft); font-size:13px;
    border-top:1px solid var(--border); }
  footer code { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:1px 6px;
    font-size:12px; color:var(--muted); user-select:all; }
</style>
</head>
<body>
<header><div class="wrap">
  <h1>${esc(reg.name || 'GCU LIBRARY')}</h1>
  <p>${esc(reg.description || '')}${reg.updated ? ' · updated ' + esc(reg.updated) : ''}</p>
</div></header>
<main>
  <div class="grid">
    ${reg.entries.map((e) => card(e, works[e.name])).join('\n    ')}
  </div>
</main>
<footer>
  Read in the browser, or install into <strong>Auditable Works</strong> — Tools → Library →
  <em>+ Add source</em> → <code>${esc(SOURCE_URL)}</code> &nbsp;·&nbsp;
  <a href="AUTHORING.md">contribute a book</a> ·
  <a href="https://github.com/gentropic/gcu-library">source</a>
</footer>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('Wrote index.html — ' + reg.entries.length + ' entries');
