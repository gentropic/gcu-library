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
// v1: "Python edition" prose = the language-neutral \pcodeonly content (ODS has
// no \pythononly; cpp/java prose is dropped). Code listings are STUBBED with
// their label (resolved from ../ods/{python,…} source in a later pass).
//
// Usage: node tools/ods-convert.mjs [odsLatexDir] [outDir]

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ODS = process.argv[2] || path.resolve(here, '../../ods/latex');
const OUT = process.argv[3] || path.resolve(here, '../books/ods');

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
\newcommand{\pcodeimport}[1]{\texttt{[listing: #1]}}
\newcommand{\codeimport}[1]{\texttt{[listing: #1]}}
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
  const { out, codes } = stashInlineCode(tex);
  let html;
  try { html = runPandoc(PREAMBLE + '\n' + out); }
  catch (e) { console.error('pandoc failed for', name, ':', (e.stderr || e.message || '').toString().slice(0, 400)); return null; }
  // restore inline code
  html = html.replace(/@@CODE(\d+)@@/g, (_, i) => `<code>${esc(codes[+i] || '')}</code>`);
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
}

main();
