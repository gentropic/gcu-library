// factbook-convert.mjs — CIA World Factbook → a kind:data .gcudat dataset.
//
// Source: github.com/factbook/factbook.json (the community structured form of
// the Factbook). The underlying data is US-government public domain (CC0-1.0);
// the factbook.json conversion is MIT, but the *data* we ship is CC0.
//
// Clone the source first (gitignored .cache):
//   git clone --depth 1 https://github.com/factbook/factbook.json .cache/factbook-json
// Then: node tools/factbook-convert.mjs   →   data/factbook/{records.json,dataset.json,CREDITS.md}
//
// v1 ships a CURATED, QUERYABLE dataset: per country a flat record of parsed
// scalars (population, area, GDP, coordinates, …) + a background blurb. The
// full nested prose (and the book-view that renders it, plus flags + a maps
// `extends` tier) are follow-ups — the raw 9.7 MB stays upstream, cached.
//
// Source quirks handled: keys carry stray whitespace (e.g. "total "), values
// are HTML prose with unit/year annotations ("$25.676 trillion (2024 est.)").

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '../.cache/factbook-json');
const OUT = path.resolve(here, '../data/factbook');

if (!fs.existsSync(SRC)) {
  console.error('source not found:', SRC);
  console.error('clone it first:\n  git clone --depth 1 https://github.com/factbook/factbook.json .cache/factbook-json');
  process.exit(1);
}

// The factbook.json region directories (each holds GEC-coded country files).
const REGIONS = [
  'africa', 'antarctica', 'australia-oceania', 'central-america-n-caribbean',
  'central-asia', 'east-n-southeast-asia', 'europe', 'middle-east',
  'north-america', 'oceans', 'south-america', 'south-asia', 'world',
];

// ── flags ──
// factbook uses GEC codes; flags are keyed by ISO 3166-1 alpha-2. Map via the
// FIPS column of datasets/country-codes (GEC ≈ FIPS 10-4), plus overrides where
// GEC and FIPS disagree. Flag PNGs come from flagcdn.com (public domain,
// Wikimedia-sourced) at w80 — tiny + uniform (a 182 KB coat-of-arms SVG is a
// ~900 B PNG), inlined as data: URLs (the reader's sandboxed iframe can't reach
// VFS paths). Source CSV: curl it into .cache first (see header).
const CC_CSV = path.resolve(here, '../.cache/country-codes.csv');
const FLAGS_CACHE = path.resolve(here, '../.cache/flags');
// Only GEC codes the FIPS column misses for a REAL country (verified). The rest
// resolve via the CSV; unmapped territories (Gaza, West Bank, Paracel…) have no
// distinct flag and stay flagless. Overrides win, so keep them correct.
const GEC_TO_ISO_OVERRIDE = { ri: 'rs', kv: 'xk' };

function parseCsv(txt) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (ch !== '\r') f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
function loadGecToIso() {
  const map = { ...GEC_TO_ISO_OVERRIDE };
  if (!fs.existsSync(CC_CSV)) {
    console.warn('no .cache/country-codes.csv — flags skipped. Fetch it:\n'
      + '  curl -sL https://raw.githubusercontent.com/datasets/country-codes/master/data/country-codes.csv -o .cache/country-codes.csv');
    return map;
  }
  const rows = parseCsv(fs.readFileSync(CC_CSV, 'utf8'));
  const fi = rows[0].indexOf('FIPS'), ii = rows[0].indexOf('ISO3166-1-Alpha-2');
  for (const r of rows.slice(1)) {
    const fips = (r[fi] || '').trim().toLowerCase(), iso = (r[ii] || '').trim().toLowerCase();
    if (fips && iso && !(fips in map)) map[fips] = iso;   // overrides win
  }
  return map;
}
const GEC_TO_ISO = loadGecToIso();

// Fetch-on-miss a flag PNG, return a data: URL (or null). Cached in .cache/flags.
async function flagDataUrl(iso2) {
  if (!iso2) return null;
  const file = path.join(FLAGS_CACHE, iso2 + '.png');
  if (!fs.existsSync(file)) {
    try {
      const res = await fetch(`https://flagcdn.com/w80/${iso2}.png`);
      if (!res.ok) return null;
      fs.mkdirSync(FLAGS_CACHE, { recursive: true });
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    } catch { return null; }
  }
  return 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
}

// Whitespace-tolerant nested getter — source keys sometimes have stray spaces.
function pick(obj, ...keys) {
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    if (k in cur) { cur = cur[k]; continue; }
    const hit = Object.keys(cur).find((kk) => kk.trim() === k);
    cur = hit !== undefined ? cur[hit] : undefined;
  }
  return cur;
}
// Source prose carries HTML entities (place names like "Bras&iacute;lia").
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', deg: '°', ndash: '–', mdash: '—',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', yacute: 'ý',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  agrave: 'à', egrave: 'è', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
  Agrave: 'À', Egrave: 'È', Igrave: 'Ì', Ograve: 'Ò', Ugrave: 'Ù',
  acirc: 'â', ecirc: 'ê', icirc: 'î', ocirc: 'ô', ucirc: 'û',
  Acirc: 'Â', Ecirc: 'Ê', Icirc: 'Î', Ocirc: 'Ô', Ucirc: 'Û',
  atilde: 'ã', ntilde: 'ñ', otilde: 'õ', Atilde: 'Ã', Ntilde: 'Ñ', Otilde: 'Õ',
  auml: 'ä', euml: 'ë', iuml: 'ï', ouml: 'ö', uuml: 'ü', yuml: 'ÿ',
  Auml: 'Ä', Euml: 'Ë', Iuml: 'Ï', Ouml: 'Ö', Uuml: 'Ü',
  ccedil: 'ç', Ccedil: 'Ç', aring: 'å', Aring: 'Å', oslash: 'ø', Oslash: 'Ø',
  aelig: 'æ', AElig: 'Æ', szlig: 'ß',
};
function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-zA-Z]+);/g, (m, n) => (n in NAMED ? NAMED[n] : m));
}
const stripHtml = (s) => decodeEntities(String(s).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const text = (c, ...p) => { const v = pick(c, ...p, 'text'); return typeof v === 'string' ? stripHtml(v) : null; };

// "338,016,259 (2025 est.)" → 338016259 ; "9,833,517 sq km" → 9833517
function num(s) {
  if (!s) return null;
  const m = String(s).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
// "$25.676 trillion (2024 est.)" → 25676000000000
function moneyUsd(s) {
  if (!s) return null;
  const m = String(s).replace(/[$,]/g, '').match(/([\d.]+)\s*(trillion|billion|million)?/i);
  if (!m) return null;
  const mult = { trillion: 1e12, billion: 1e9, million: 1e6 }[(m[2] || '').toLowerCase()] || 1;
  return Math.round(parseFloat(m[1]) * mult);
}
// "38 00 N, 97 00 W" → [38.0, -97.0]  (decimal degrees, lat then lon)
function coords(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+)\s+(\d+)\s+([NS]),?\s*(\d+)\s+(\d+)\s+([EW])/);
  if (!m) return null;
  let lat = +m[1] + +m[2] / 60; if (m[3] === 'S') lat = -lat;
  let lon = +m[4] + +m[5] / 60; if (m[6] === 'W') lon = -lon;
  const r = (x) => Math.round(x * 1e4) / 1e4;
  return [r(lat), r(lon)];
}
// The Real-GDP block keys the latest year into the key name; grab the newest.
function latestGdp(c) {
  const e = pick(c, 'Economy', 'Real GDP (purchasing power parity)');
  if (!e || typeof e !== 'object') return null;
  const years = Object.keys(e).filter((k) => /\d{4}/.test(k)).sort().reverse();
  return years.length ? pick(e[years[0]], 'text') : null;
}

// ── book-view rendering ──
// The pack is dual-faced: records.json is the lean queryable dataset (scalars),
// and a book.json + chapters/<id>.html render the FULL source profile as a
// readable country page (the reader opens any dir with a book.json). One pack,
// two faces — std.data() reads the data, the reader reads the book.
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const clean = (s) => decodeEntities(String(s).replace(/<\/?(?:p|strong|em|br)\s*\/?>/gi, ' ')).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// Render one source field: a {text} leaf, or a nest of named sub-fields.
function renderField(val) {
  if (val == null) return '';
  if (typeof val === 'string') return `<p class="note">${esc(clean(val))}</p>`;
  if (val.text != null && Object.keys(val).length === 1) return `<p>${esc(clean(val.text))}</p>`;
  let out = '';
  if (val.text != null) out += `<p>${esc(clean(val.text))}</p>`;
  const subs = Object.entries(val).filter(([k]) => k !== 'text');
  if (subs.length) {
    out += '<dl>';
    for (const [sub, sv] of subs) {
      if (sub === 'note') { out += `<dd class="note">${esc(clean(typeof sv === 'string' ? sv : sv.text || ''))}</dd>`; continue; }
      const t = sv && sv.text != null ? clean(sv.text) : (typeof sv === 'string' ? clean(sv) : '');
      if (t) out += `<dt>${esc(sub.trim())}</dt><dd>${esc(t)}</dd>`;
    }
    out += '</dl>';
  }
  return out;
}

function renderChapter(rec, c, flag) {
  const facts = [
    ['Capital', rec.capital], ['Government', rec.government],
    ['Area', rec.area_km2 != null ? rec.area_km2.toLocaleString() + ' km²' : null],
    ['Population', rec.population != null ? rec.population.toLocaleString() : null],
    ['GDP (PPP)', rec.gdp_ppp_usd != null ? '$' + (rec.gdp_ppp_usd / 1e9).toLocaleString() + ' billion' : null],
    ['Coordinates', rec.coordinates ? rec.coordinates.join(', ') : null],
  ].filter(([, v]) => v != null);
  const flagImg = flag ? `<img src="${flag}" alt="" width="40" style="vertical-align:middle;margin-right:.5em;border:1px solid rgba(128,128,128,.35)"> ` : '';
  let html = `<h1>${flagImg}${esc(rec.name)}</h1>\n`;
  html += '<table class="facts">' + facts.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('') + '</table>\n';
  // Full profile sections, in source order, skipping empty ones.
  for (const [section, body] of Object.entries(c)) {
    if (!body || typeof body !== 'object') continue;
    let inner = '';
    for (const [field, val] of Object.entries(body)) {
      const f = renderField(val);
      if (f) inner += `<h3>${esc(field.trim())}</h3>\n${f}\n`;
    }
    if (inner) html += `<h2>${esc(section.trim())}</h2>\n${inner}`;
  }
  return html;
}

function toRecord(id, region, c) {
  // The conventional short form is the country name; entities without one
  // (the World aggregate + the 5 oceans) aren't countries — caller drops them.
  const name = text(c, 'Government', 'Country name', 'conventional short form');
  if (!name) return null;
  return {
    id,
    name,
    region,
    iso2: GEC_TO_ISO[id] || null,
    capital: text(c, 'Government', 'Capital', 'name'),
    government: text(c, 'Government', 'Government type'),
    area_km2: num(text(c, 'Geography', 'Area', 'total')),
    population: num(text(c, 'People and Society', 'Population', 'total')),
    coordinates: coords(text(c, 'Geography', 'Geographic coordinates')),
    gdp_ppp_usd: moneyUsd(latestGdp(c)),
    background: text(c, 'Introduction', 'Background'),
  };
}

const entries = [];   // { rec, c } — kept paired so chapters render from the full profile
let skipped = 0;
const missing = { capital: 0, area_km2: 0, population: 0, coordinates: 0, gdp_ppp_usd: 0 };
for (const region of REGIONS) {
  const dir = path.join(SRC, region);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const id = f.replace(/\.json$/, '');
    let c;
    try { c = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    const rec = toRecord(id, region, c);
    if (!rec) { skipped++; continue; }           // unnamed entity (World / oceans)
    for (const k of Object.keys(missing)) if (rec[k] == null) missing[k]++;
    entries.push({ rec, c });
  }
}
entries.sort((a, b) => a.rec.name.localeCompare(b.rec.name));
const records = entries.map((e) => e.rec);

const FIELDS = ['id', 'name', 'region', 'iso2', 'capital', 'government', 'area_km2', 'population', 'coordinates', 'gdp_ppp_usd', 'background'];
const dataset = {
  dataset: 1,
  name: 'factbook',
  title: 'CIA World Factbook',
  version: '1.1.0',
  license: 'CC0-1.0',
  attribution: 'US Central Intelligence Agency — public domain',
  source: 'https://github.com/factbook/factbook.json',
  description: 'Per-country reference data from the CIA World Factbook — population, area, GDP, capital, government, coordinates, and a background blurb for ' + records.length + ' countries and entities.',
  tags: ['reference', 'dataset', 'geography', 'countries'],
  records: 'records.json',
  count: records.length,
  fields: FIELDS,
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'records.json'), JSON.stringify(records));
fs.writeFileSync(path.join(OUT, 'dataset.json'), JSON.stringify(dataset, null, 2) + '\n');

// Book-view: one HTML chapter per country (full profile) + a book.json spine.
// Lets the pack open in the reader; std.data still reads records.json. Stale
// chapters from a prior run are cleared so renamed/removed entries don't linger.
const chaptersDir = path.join(OUT, 'chapters');
fs.rmSync(chaptersDir, { recursive: true, force: true });
fs.mkdirSync(chaptersDir, { recursive: true });
// Warm the flag cache in parallel (first run fetches; later runs read .cache).
const isoNeeded = [...new Set(entries.map((e) => e.rec.iso2).filter(Boolean))];
await Promise.all(isoNeeded.map((iso) => flagDataUrl(iso)));
let flagged = 0;
const chapters = [];
for (const { rec, c } of entries) {
  const flag = await flagDataUrl(rec.iso2);
  if (flag) flagged++;
  fs.writeFileSync(path.join(chaptersDir, rec.id + '.html'), renderChapter(rec, c, flag));
  chapters.push({ id: rec.id, title: rec.name, file: 'chapters/' + rec.id + '.html', format: 'html' });
}
const book = {
  title: dataset.title, slug: 'factbook', version: dataset.version,
  license: dataset.license, author: dataset.attribution,
  source: dataset.source, description: dataset.description, tags: dataset.tags,
  chapters,
};
fs.writeFileSync(path.join(OUT, 'book.json'), JSON.stringify(book, null, 2) + '\n');

// ── expansion tier: factbook-full ──
// The complete nested profile per country, keyed by id, extends the base.
// std.data merges this under .profile when installed (the heavy, opt-in tier).
const FULL = path.resolve(here, '../data/factbook-full');
fs.mkdirSync(FULL, { recursive: true });
const fullRecords = entries.map(({ rec, c }) => ({ id: rec.id, profile: c }));
fs.writeFileSync(path.join(FULL, 'records.json'), JSON.stringify(fullRecords));
const fullDataset = {
  dataset: 1,
  name: 'factbook-full',
  extends: 'factbook',
  title: 'CIA World Factbook — full profiles',
  version: '1.0.0',   // the expansion's own first release (independent of the base)
  license: dataset.license,
  attribution: dataset.attribution,
  source: dataset.source,
  description: 'Expansion tier for the factbook pack: the complete nested CIA World Factbook '
    + 'profile for every country (all sections). Install alongside factbook and std.data("factbook") '
    + 'records gain a .profile field with the full data.',
  tags: ['reference', 'dataset', 'geography', 'countries'],
  records: 'records.json',
  count: fullRecords.length,
  fields: ['id', 'profile'],
};
fs.writeFileSync(path.join(FULL, 'dataset.json'), JSON.stringify(fullDataset, null, 2) + '\n');
fs.writeFileSync(path.join(FULL, 'CREDITS.md'),
  '# CIA World Factbook — full profiles\n\n'
  + 'Expansion tier for `factbook`. Source: The World Factbook (US CIA), structured\n'
  + 'form https://github.com/factbook/factbook.json. License: **CC0-1.0 / public domain**.\n');
const fullKb = (fs.statSync(path.join(FULL, 'records.json')).size / 1048576).toFixed(1);
console.log(`Wrote data/factbook-full/ — ${fullRecords.length} full profiles (records.json ${fullKb} MB), extends factbook`);
fs.writeFileSync(path.join(OUT, 'CREDITS.md'),
  '# CIA World Factbook\n\n'
  + 'Source: The World Factbook, US Central Intelligence Agency.\n'
  + 'Structured form: https://github.com/factbook/factbook.json\n\n'
  + 'License: **CC0-1.0 / public domain**. US Government works are not subject to\n'
  + 'copyright; the factbook.json project dedicates its datasets to the public domain.\n\n'
  + '## Flags\n\n'
  + 'Flag images (book-view chapter headers): https://flagcdn.com (flagpedia.net),\n'
  + 'based on Wikimedia Commons vector files — public domain, no attribution required.\n');

const recKb = (fs.statSync(path.join(OUT, 'records.json')).size / 1024).toFixed(0);
const chBytes = fs.readdirSync(chaptersDir).reduce((s, f) => s + fs.statSync(path.join(chaptersDir, f)).size, 0);
console.log(`Wrote data/factbook/ — ${records.length} records (records.json ${recKb} KB) + ${chapters.length} chapters (${(chBytes / 1048576).toFixed(1)} MB); ${flagged} flags; skipped ${skipped} unnamed (World + oceans)`);
console.log('missing scalars:', Object.entries(missing).map(([k, v]) => `${k}:${v}`).join(' '));
