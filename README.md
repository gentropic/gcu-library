# gcu-library

Prepared **books and reference content** for the GCU reader (Auditable Works'
book surface), plus the conversion tooling that produces them. Kept out of the
`auditable` repo so that one stays lean — heavy, externally-sourced, license-laden
content lives here and ships to the reader as **content-packs**.

## Layout

```
tools/                 conversion tooling (source → reader book)
  ods-convert.mjs      Open Data Structures LaTeX → book.json + HTML chapters
books/
  <slug>/
    book.json          reader manifest (title/author/license/chapters)
    CREDITS.md         attribution + license for the source work
    chapters/*.html    converted chapters (reflowable; math as \(…\)/$$…$$ for KaTeX)
```

A **book** is the reader's content model: a `book.json` (chapter spine +
metadata) with chapters as `{ file, format: 'md' | 'html' }`. The reader keeps
math as TeX delimiters (`\(…\)`, `\[…\]`, `$$…$$`) and renders it with KaTeX
(MathML output). See the auditable repo's book-reader surface.

## Books

### `ods` — Open Data Structures (Pat Morin, CC BY 2.5)

Converted from the LaTeX source (`opendatastructures.org`, clone expected at
`../ods` relative to this repo) via `tools/ods-convert.mjs`.

- **v1 (current):** prose + math + section structure + inline code. The
  language-neutral (pseudocode) prose edition; C++/Java-specific prose dropped.
- **stubbed, pending:** code listings (`\codeimport{…}` → `[listing: label]`
  placeholders; resolve from `../ods/python` source next) and figures.

Regenerate: `node tools/ods-convert.mjs` (needs `pandoc` on PATH + `../ods`).

## Distribution

Books here are intended to ship as **content-packs** — a ZIP of pure data
(`content.json` manifest + the book files + license), installed into the
reader's `/usr/share/books` or `/home/.books`. The pack format + builder land
here; the consumer lives in `auditable`. (Until then, a book dir can be loaded
into the reader directly.)

## Licenses

Every book carries its source work's license + attribution in
`books/<slug>/CREDITS.md`, and `book.json`'s `license` field. Conversion
(LaTeX → HTML) is a format change, not a modification of the work.
