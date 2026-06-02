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

function toRecord(id, region, c) {
  // The conventional short form is the country name; entities without one
  // (the World aggregate + the 5 oceans) aren't countries — caller drops them.
  const name = text(c, 'Government', 'Country name', 'conventional short form');
  if (!name) return null;
  return {
    id,
    name,
    region,
    capital: text(c, 'Government', 'Capital', 'name'),
    government: text(c, 'Government', 'Government type'),
    area_km2: num(text(c, 'Geography', 'Area', 'total')),
    population: num(text(c, 'People and Society', 'Population', 'total')),
    coordinates: coords(text(c, 'Geography', 'Geographic coordinates')),
    gdp_ppp_usd: moneyUsd(latestGdp(c)),
    background: text(c, 'Introduction', 'Background'),
  };
}

const records = [];
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
    records.push(rec);
  }
}
records.sort((a, b) => a.name.localeCompare(b.name));

const FIELDS = ['id', 'name', 'region', 'capital', 'government', 'area_km2', 'population', 'coordinates', 'gdp_ppp_usd', 'background'];
const dataset = {
  dataset: 1,
  name: 'factbook',
  title: 'CIA World Factbook',
  version: '1.0.0',
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
fs.writeFileSync(path.join(OUT, 'CREDITS.md'),
  '# CIA World Factbook\n\n'
  + 'Source: The World Factbook, US Central Intelligence Agency.\n'
  + 'Structured form: https://github.com/factbook/factbook.json\n\n'
  + 'License: **CC0-1.0 / public domain**. US Government works are not subject to\n'
  + 'copyright; the factbook.json project dedicates its datasets to the public domain.\n');

const kb = (fs.statSync(path.join(OUT, 'records.json')).size / 1024).toFixed(0);
console.log(`Wrote data/factbook/ — ${records.length} records, records.json ${kb} KB (skipped ${skipped} unnamed: World + oceans)`);
console.log('missing scalars:', Object.entries(missing).map(([k, v]) => `${k}:${v}`).join(' '));
