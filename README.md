# gcu-library

Prepared **books and reference content** for the GCU reader (Auditable Works'
book surface), plus the conversion tooling that produces them. Kept out of the
`auditable` repo so that one stays lean — heavy, externally-sourced, license-laden
content lives here and ships to the reader as **content-packs** (`.gcudat`),
discoverable + installable through the **Browse Library** registry.

- **Authoring content?** → **[`AUTHORING.md`](AUTHORING.md)** (pack format,
  conversion, build, versioning, licensing).
- **Standing up a registry?** → **[`REGISTRY.md`](REGISTRY.md)**.
- This repo is the **default registry source** — `registry.json` at the root,
  served via `raw.githubusercontent.com/gentropic/gcu-library/main/registry.json`.

## Layout

```
registry.json          the catalog (built; served as the default source)
dist/<slug>.gcudat      built content-packs — DELIVERABLES, committed (the
                        registry serves them by URL; do not gitignore)
tools/                  conversion + build tooling
  ods-convert.mjs       Open Data Structures LaTeX → book dir
  ray-convert.mjs       Ray Tracing series (markdeep) → book dirs
  build-gcudat.mjs      a pack dir → dist/<slug>.gcudat (+ writes gcudat.json)
  build-registry.mjs    every dist/*.gcudat → registry.json (size + SRI)
books/<slug>/           book content packs
  book.json             reader manifest (spine + metadata + version)
  gcudat.json           pack manifest (written by build-gcudat; self-describing)
  chapters/*.md|html    chapters (reflowable; math as TeX for KaTeX; images inline)
  CREDITS.md            source attribution + license
```

A **book** is the reader's content model: a `book.json` (chapter spine +
metadata) with chapters as `{ file, format: 'md' | 'html' | 'pdf' }`. Math stays
in TeX delimiters (`\(…\)`, `\[…\]`, `$$…$$`) and renders with KaTeX (MathML).

## Organization

Content is **kind-named top-level dirs**: `books/` today; `datasets/`,
`manuals/`, … as content diversifies. Each pack dir is **self-describing** via
its `gcudat.json` `kind`, so `build-registry.mjs` scans every content root and
registers any kind with no code change. (`build-gcudat`/consumer handlers are
the only kind-aware pieces — see `AUTHORING.md` § *Adding a new kind*.)

Discovery is **metadata-driven**, not folder-driven — the registry entry carries:

- **`datKind`** — `books` | `geodata` | `data` | … — drives the Library's icon
  and the per-kind filter.
- **`tags`** — free-form, searchable/filterable in the Library + `pkg search`.
  Keep them short and reusable (e.g. `tutorial`, `graphics`, `geostatistics`,
  `reference`, `textbook`). Prefer an existing tag over a near-synonym.

So you rarely *need* new folders — a new book just goes in `books/` with good
`tags`. New folders are for genuinely new **kinds**.

## Books

### `ods` — Open Data Structures (Pat Morin, CC BY 2.5)
LaTeX source (`opendatastructures.org`, clone at `../ods`) via
`tools/ods-convert.mjs`. Prose + KaTeX math + real Python listings + figures
(`.ipe` → PNG, inlined). Regenerate: `node tools/ods-convert.mjs`.

### Ray Tracing series (Shirley/Black/Hollasch, CC0)
`rtow` / `rtnw` / `rtrol` from the markdeep sources via `tools/ray-convert.mjs`.
Prose + KaTeX math + `cpp` code blocks + inlined figures.

## Build & publish (quick reference)

```sh
node tools/build-gcudat.mjs <slug>   # pack dir → dist/<slug>.gcudat
node tools/build-registry.mjs        # → registry.json (size + SRI)
git add books/<slug> dist/<slug>.gcudat registry.json && git commit && git push
```

Bump `book.json`'s `version` when content changes → the reader shows **Update ↑**.
Full details in [`AUTHORING.md`](AUTHORING.md).

## Licenses

Every pack carries its source work's license + attribution in
`books/<slug>/CREDITS.md` and `book.json`'s `license`. Conversion (LaTeX /
markdeep / EPUB → HTML) is a format change, not a modification of the work.
**Verify the license before adding content.** `*-NC` packs show a
non-commercial badge in the Library.
