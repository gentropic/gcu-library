// ods-convert.mjs — Open Data Structures LaTeX → reader book (book.json + HTML chapters).
//
// ODS uses a custom build (a `#…#` inline-code catcode shorthand, language
// conditionals \cpponly/\javaonly/\pcodeonly, and code-import macros). We:
//   1. JS-preprocess the `#…#` shorthand (pandoc can't parse the catcode hack)
//      into placeholders, restored to <code> after pandoc.
//   2. Feed pandoc a preamble that defines the ODS macros for the chosen
//      edition — pandoc (a real LaTeX parser) does the brace-matched expansion.
//   3. pandoc -f latex -t html --mathjax → math stays as \(…\)/\[…\] verbatim,
//      which the reader's KaTeX renders to MathML.
//
// "Python edition": prose = the language-neutral \pcodeonly content (ODS has no
// \pythononly; cpp/java prose is dropped). Code listings (\codeimport /
// \pcodeimport) are resolved to RAW PYTHON pulled from ../ods/python/ods/*.py
// — we reimplement snarf-python.py's label→def extraction (NOT its
// pseudocode translation), so the reader shows real, highlightable code.
//
// Usage: node tools/ods-convert.mjs [odsLatexDir] [outDir]

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ODS = process.argv[2] || path.resolve(here, '../../ods/latex');
const OUT = process.argv[3] || path.resolve(here, '../books/ods');
const PYDIR = path.resolve(ODS, '../python/ods');   // ../ods/python/ods/*.py

// ── Figure rendering (Ipe .ipe → PNG via iperender + LaTeX) ──────────────
// OPTIONAL. ODS figures are Ipe vector sources whose labels are typeset
// through LaTeX, so rendering needs: iperender (the Ipe CLI) + a LaTeX distro
// (pdflatex) + ods.sty/ods-colors.sty on TEXINPUTS. If the tools aren't found
// the converter still runs and leaves a [figure: name] placeholder. Override
// the auto-located tools via IPERENDER / MIKTEX_BIN env vars; PNG dpi via
// FIG_DPI. Rendered PNGs are cached on disk (../.cache/ods-figs) so re-runs
// don't re-LaTeX every figure.
const HOME = process.env.USERPROFILE || process.env.HOME || '';
function _glob1(dir, re) {
  try { const n = fs.readdirSync(dir).find((x) => re.test(x)); return n ? path.join(dir, n) : null; }
  catch { return null; }
}
function findIperender() {
  if (process.env.IPERENDER && fs.existsSync(process.env.IPERENDER)) return process.env.IPERENDER;
  const ipePkg = _glob1(path.join(HOME, 'AppData/Local/Microsoft/WinGet/Packages'), /^OtfriedCheong\.Ipe/);
  const ver = ipePkg && _glob1(ipePkg, /^ipe-/);
  const exe = ver && path.join(ver, 'bin/iperender.exe');
  return exe && fs.existsSync(exe) ? exe : null;
}
function findMiktexBin() {
  if (process.env.MIKTEX_BIN && fs.existsSync(process.env.MIKTEX_BIN)) return process.env.MIKTEX_BIN;
  const p = path.join(HOME, 'AppData/Local/Programs/MiKTeX/miktex/bin/x64');
  return fs.existsSync(path.join(p, 'pdflatex.exe')) ? p : null;
}
const IPERENDER = findIperender();
const MIKTEX_BIN = findMiktexBin();
const FIG_DPI = process.env.FIG_DPI || '150';
const FIGCACHE = path.resolve(here, '../.cache/ods-figs');
const FIG_TMPLX = path.join(FIGCACHE, '_latex');
const FIGURES_ON = !!(IPERENDER && MIKTEX_BIN);
const figEnv = FIGURES_ON ? {
  ...process.env,
  PATH: [MIKTEX_BIN, path.dirname(IPERENDER), process.env.PATH].filter(Boolean).join(path.delimiter),
  IPELATEXDIR: FIG_TMPLX,                  // where iperender runs latex
  TEXINPUTS: ODS + path.delimiter,         // so pdflatex finds ods(-colors).sty
} : null;
const _figCache = new Map();
const _figStats = { rendered: 0, cached: 0, failed: 0 };
// name (from <img src="figs/name">) → data:image/png URL, or null if it can't
// be rendered (missing .ipe, no toolchain, or latex error).
function renderFigure(name) {
  if (_figCache.has(name)) return _figCache.get(name);
  let result = null;
  const ipe = path.join(ODS, 'figs', name + '.ipe');
  if (FIGURES_ON && fs.existsSync(ipe)) {
    const png = path.join(FIGCACHE, name + '.png');
    try {
      if (!fs.existsSync(png)) {
        fs.mkdirSync(FIG_TMPLX, { recursive: true });
        execFileSync(IPERENDER, ['-png', '-resolution', FIG_DPI, ipe, png], { env: figEnv, stdio: 'pipe' });
        _figStats.rendered++;
      } else { _figStats.cached++; }
      result = 'data:image/png;base64,' + fs.readFileSync(png).toString('base64');
    } catch { _figStats.failed++; result = null; }
  }
  _figCache.set(name, result);
  return result;
}

// Chapter order from ods.tex's \include list (the -lang suffix is the build's
// generated variant; the base file is <name>.tex).
const CHAPTERS = [
  'why', 'intro', 'arrays', 'linkedlists', 'skiplists', 'hashing',
  'binarytrees', 'rbs', 'scapegoat', 'redblack', 'heaps', 'sorting',
  'graphs', 'integers', 'btree',
];

// Preamble fed to pandoc: defines the ODS macros for our edition so pandoc
// expands them (brace-matching, nesting — all handled by pandoc's parser).
const PREAMBLE = String.raw`
\newcommand{\pcodeonly}[1]{#1}
\newcommand{\javaonly}[1]{}
\newcommand{\cpponly}[1]{}
\newcommand{\cppimport}[1]{}
\newcommand{\javaimport}[1]{}
\newcommand{\htmlonly}[1]{}
\newcommand{\notpcode}[1]{}
\newtheorem{thm}{Theorem}
\newtheorem{lem}{Lemma}
\newtheorem{cor}{Corollary}
\newtheorem{exc}{Exercise}
\newtheorem{prp}{Property}
`;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Python code-listing resolution (reimplements snarf-python.py extraction) ──
const _pyCache = new Map();
function pySource(clazz) {
  const key = clazz.toLowerCase();
  if (!_pyCache.has(key)) {
    const f = path.join(PYDIR, key + '.py');
    _pyCache.set(key, fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n') : null);
  }
  return _pyCache.get(key);
}
// Normalized signature of a `def` line: name (sans leading/trailing _) +
// args (sans self, sans spaces). Mirrors snarf's matches().
function defSig(line) {
  const m = line.match(/^(\s{4})?def\s+(\w+)(\(.*\))\s*:/);
  if (!m) return null;
  const name = m[2].replace(/^_+|_+$/g, '');
  const args = m[3].replace(/^\(self\s*,?\s*/, '(').replace(/\s+/g, '');
  return name + args;
}
let _stats = { resolved: 0, stub: 0 };
// label e.g. "ods/ArrayStack.add(i,x)" → the matching method bodies as raw
// Python, or null if the class file or methods aren't found.
function resolveListing(label) {
  const lm = label.match(/^\w+\/(\w+)(.*)$/);
  if (!lm) return null;
  const clazz = lm[1];
  let methods = lm[2].replace(/^\./, '').split('.').filter(Boolean);
  // a bare-word member (no parens) → also pull initialize() (sets the members)
  if (methods.some((s) => /^\w+$/.test(s))) methods.push('initialize()');
  methods = methods.map((s) => s.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase());
  const code = pySource(clazz);
  if (!code) return null;
  const out = [];
  let printing = false, indent = '';
  for (const line of code) {
    if (printing) printing = (line.trim() === '' || line.startsWith(indent));
    if (!printing) {
      const sig = defSig(line);
      if (sig && methods.includes(sig)) {
        indent = (line.match(/^\s*/)[0]) + '    ';
        if (out.length) out.push('');
        printing = true;
      }
    }
    if (printing && line.trim().length > 0) out.push(line);
  }
  return out.length ? out.join('\n') : null;
}
// Replace \codeimport / \pcodeimport (the current edition's listings) with
// placeholders, resolving each to Python. \cppimport / \javaimport stay
// dropped by the preamble (other-language listings).
function stashListings(tex) {
  const listings = [];
  const out = tex.replace(/\\(?:code|pcode)import\{([^}]*)\}/g, (_, label) => {
    const code = resolveListing(label);
    if (code) _stats.resolved++; else _stats.stub++;
    listings.push({ label, code });
    return `@@LISTING${listings.length - 1}@@`;
  });
  return { out, listings };
}

// `#…#` ODS inline-code shorthand → placeholder (pandoc can't parse the
// catcode hack). Restored to <code> post-pandoc, so the snippet bypasses
// LaTeX escaping entirely.
function stashInlineCode(tex) {
  const codes = [];
  const out = tex.replace(/#([^#\n]*)#/g, (_, c) => { codes.push(c); return `@@CODE${codes.length - 1}@@`; });
  return { out, codes };
}

function runPandoc(latex) {
  return execFileSync('pandoc', ['-f', 'latex', '-t', 'html', '--mathjax'],
    { input: latex, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function chapterTitle(tex, fallback) {
  const m = tex.match(/\\chapter\*?\{([^}]*)\}/);
  return m ? m[1].replace(/\\[a-zA-Z]+/g, '').trim() : fallback;
}

function convertChapter(name) {
  const src = path.join(ODS, name + '.tex');
  if (!fs.existsSync(src)) { console.warn('skip (missing):', name); return null; }
  const tex = fs.readFileSync(src, 'utf8');
  const title = chapterTitle(tex, name);
  const { out: t1, codes } = stashInlineCode(tex);
  const { out: t2, listings } = stashListings(t1);
  let html;
  try { html = runPandoc(PREAMBLE + '\n' + t2); }
  catch (e) { console.error('pandoc failed for', name, ':', (e.stderr || e.message || '').toString().slice(0, 400)); return null; }
  // restore inline code + code listings
  html = html.replace(/@@CODE(\d+)@@/g, (_, i) => `<code>${esc(codes[+i] || '')}</code>`);
  html = html.replace(/@@LISTING(\d+)@@/g, (_, i) => {
    const l = listings[+i];
    return l && l.code
      ? `<pre class="listing"><code class="language-python">${esc(l.code)}</code></pre>`
      : `<pre class="listing-stub"><code>[listing: ${esc(l ? l.label : '?')}]</code></pre>`;
  });
  // figures: <img src="figs/NAME"> → rendered PNG data URL (or placeholder).
  // Inlined because the reader renders chapters in a sandboxed iframe that
  // can't reach VFS-relative image paths (same as the epub ingest path).
  html = html.replace(/<img([^>]*)>/g, (m, attrs) => {
    const sm = attrs.match(/src="figs\/([^"]+)"/);
    if (!sm) return m;
    const data = renderFigure(sm[1]);
    return data
      ? '<img class="figure"' + attrs.replace(/src="figs\/[^"]+"/, `src="${data}"`) + '>'
      : `<span class="figure-stub">[figure: ${esc(sm[1])}]</span>`;
  });
  return { id: name, title, html };
}

function main() {
  fs.mkdirSync(path.join(OUT, 'chapters'), { recursive: true });
  const chapters = [];
  let n = 0;
  for (const name of CHAPTERS) {
    const r = convertChapter(name);
    if (!r) continue;
    n++;
    const file = 'chapters/' + String(n).padStart(2, '0') + '-' + r.id + '.html';
    fs.writeFileSync(path.join(OUT, file), r.html);
    chapters.push({ id: r.id, title: r.title, file, format: 'html' });
    console.log('  ✓', file, '—', r.title, `(${(r.html.length / 1024).toFixed(0)}KB)`);
  }
  const book = {
    title: 'Open Data Structures (Python edition)',
    author: 'Pat Morin',
    lang: 'en',
    slug: 'ods',
    license: 'CC BY 2.5',
    source: 'https://opendatastructures.org',
    chapters,
  };
  fs.writeFileSync(path.join(OUT, 'book.json'), JSON.stringify(book, null, 2));
  console.log(`\nWrote ${chapters.length} chapters + book.json to ${OUT}`);
  console.log(`Code listings: ${_stats.resolved} resolved → Python, ${_stats.stub} stubbed (unresolved label/class)`);
  if (FIGURES_ON) console.log(`Figures: ${_figStats.rendered} rendered + ${_figStats.cached} cached → PNG, ${_figStats.failed} failed`);
  else console.log('Figures: DISABLED (iperender/pdflatex not found) — left as placeholders. Set IPERENDER / MIKTEX_BIN.');
}

main();
