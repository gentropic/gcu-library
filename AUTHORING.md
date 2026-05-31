# Authoring content packs for the GCU library

This guide is for **producing content** — books, manuals, datasets — that ships
to the GCU reader (Auditable Works' book surface) as a **`.gcudat` content
pack**, and lands in the **Browse Library** registry so anyone can install it.

If you're an AI assistant working in another repo and want to contribute
content: **author it here, in `gcu-library`** (see [Where content lives](#where-content-lives)).
The consumer-side contract is auditable's `ext/EXTENSION_SPEC.md §6.2`; this is
the producer-side how-to.

---

## TL;DR

```
books/<slug>/
  book.json            reader manifest (spine + metadata + version)
  chapters/*.md|html   the content (math as TeX for KaTeX; images inline)
  CREDITS.md           source attribution + license
# then:
node tools/build-gcudat.mjs <slug>     # → dist/<slug>.gcudat (writes gcudat.json)
node tools/build-registry.mjs          # → registry.json (SRI + size)
git add books/<slug> dist/<slug>.gcudat registry.json && git commit && git push
```

A user installs it from **Tools → Library** (or `pkg install <slug>` in a geas
terminal), and it opens in the reader.

---

## The two formats

> **`.gcupkg` = a package that *runs*** (code extension — surfaces, cell types).
> **`.gcudat` = data that's only *read*** (a book, a dataset). The installer
> **never evaluates** a `.gcudat`, which is why it's lower-trust.

This guide is about `.gcudat`. (For code extensions, see
`ext/EXTENSION_SPEC.md` in the auditable repo.)

A `.gcudat` is **container-agnostic**: a `.tgz`, a `.zip`, or a bare directory
are all valid — detection is by the **manifest** (`gcudat.json` at the root),
not the file extension.

### `gcudat.json` — the pack manifest

Written for you by `build-gcudat.mjs` (you usually don't hand-author it). The
pack is **self-describing** — it carries its own version, so updates work:

```json
{
  "gcudat": 1,                 // format marker (the sniff target)
  "kind": "books",             // routes to a consumer handler
  "name": "rtnw",              // unique id (also the registry entry name + ledger key)
  "title": "Ray Tracing: The Next Week",
  "version": "1.0.1",          // bump this → users see "Update ↑"
  "license": "CC0-1.0",
  "attribution": "Peter Shirley, Trevor David Black, Steve Hollasch",
  "index": "book.json"         // kind-specific entry pointer
}
```

`kind` is the discriminator the reader routes on. Today the shipped kind is
**`books`** (installs to `/home/.books/library/<name>/`, opens in the reader).
New kinds add their own consumer handler in auditable; see *Adding a new kind*.

### `book.json` — the reader manifest (for `kind: books`)

```json
{
  "title": "Ray Tracing: The Next Week",
  "author": "Peter Shirley, Trevor David Black, Steve Hollasch",
  "lang": "en",
  "slug": "rtnw",
  "license": "CC0-1.0",
  "version": "1.0.1",
  "source": "https://raytracing.github.io",
  "katexMacros": { "\\div": "\\operatorname{div}" },   // optional, extends KaTeX
  "chapters": [
    { "id": "c1", "title": "About",       "file": "chapters/01-about.md",       "format": "md" },
    { "id": "c2", "title": "Motion Blur",  "file": "chapters/03-motion-blur.md", "format": "md" }
  ]
}
```

- **`version`** flows into `gcudat.json` (and the registry entry). Bump it when
  you change content — that's what drives the reader's update detection.
- **`chapters[].format`** is `md`, `html`, or `pdf`.
  - `md` / `html` — reflowable; supports highlights, search, math.
  - `pdf` — fixed-layout (needs the PDF backend; works-all only). Selectable
    text + per-page search, but offset-anchored highlights don't apply.
- **`id`** is a stable per-chapter key (used by reading-state anchors). Don't
  renumber it across versions if you can help it.

---

## Writing chapters

The reader renders `md` via auditable's `renderMd` and `html` verbatim (after a
sanitiser). A few rules that matter:

- **Math is KaTeX (MathML output).** Keep TeX in delimiters: `\(inline\)`,
  `\[display\]`, `$$display$$`. A **single `$` is NOT a delimiter** (so prose
  prices are safe). Extend macros per-book via `book.json`'s `katexMacros`.
- **Code blocks are fenced** ` ```lang `. The fence-lang capture is `\w*`, so
  map languages to a word-safe token — **`C++` → `cpp`**, `C#` → `csharp`.
- **Images inline as `data:` URLs.** The reader has no asset server, so embed
  figures: `![caption](data:image/png;base64,…)`. (A converter typically
  fetches the source image and base64-encodes it.) Keep them reasonably sized —
  the whole pack is gzipped, but multi-MB inline images bloat the install.
- **Headings** get anchors + feed the per-book search index and the outline.

---

## Conversion patterns

Most content starts from some source format. The existing converters in
`tools/` are worked examples — copy the closest one:

- **LaTeX → `tools/ods-convert.mjs`** (Open Data Structures). Uses `pandoc -f
  latex -t html --mathjax` (keeps math as `\(…\)`/`\[…\]`), a preamble that
  defines the source's macros so pandoc brace-matches them, and figure
  rendering (`.ipe` → PNG via iperender) inlined as `data:`.
- **Markdeep → `tools/ray-convert.mjs`** (Ray Tracing series). Markdeep gotchas
  that bit, all handled there:
  - code fences are `~~~~ <lang>` (lang *after* the tildes); **"added" lines are
    consecutive fenced segments** with only the final terminator bare — strip
    the internal segment fences or they leak into the block.
  - long listings hide in `<script type="preformatted">` mid-document — unwrap
    them; don't split the doc on the first `<script>`.
  - image alts contain brackets (`![Figure [id]: cap](…)`) — bracket-safe regex.
  - inline math can wrap across lines.
- **EPUB → in-app.** No converter needed: drop a `.epub` on Works (or File →
  Import book), which runs `@gcu/epub` → writes a book dir. To ship it, copy
  the resulting `/home/.books/library/<slug>/` out into `books/<slug>/`.
- **Plain Markdown/HTML → no converter.** Just write `chapters/*.md` + a
  `book.json` by hand.

> **renderMd gotcha (already fixed in auditable, but know it):** inline rules
> like `++keys++` once mangled `++`-containing base64 inside `data:` image URLs.
> If you hit a broken inline image, check the data URL didn't get rewritten.

---

## Build & publish

```sh
# 1. package the pack dir → dist/<slug>.gcudat (also writes books/<slug>/gcudat.json)
node tools/build-gcudat.mjs <slug>

# 2. (re)generate the registry from every dist/*.gcudat
node tools/build-registry.mjs

# 3. commit BOTH the pack and the built artifact + registry, then push
git add books/<slug> dist/<slug>.gcudat registry.json
git commit -m "add <slug>"
git push
```

> **Gotcha that has bitten us:** `dist/*.gcudat` are **deliverables** — the
> registry serves them by URL. They must be **committed and pushed**, or the
> live registry's entry URLs 404. The `.gitignore` is set to keep them
> (`dist/*` + `!dist/*.gcudat`). Don't "clean up" dist.

### Updating a pack

Bump `book.json`'s `version` (semver), rebuild (`build-gcudat` + `build-registry`),
commit + push. The reader compares the registry version against its install
ledger and shows **Update ↑**; users who installed before the ledger existed
get a **↻ Reinstall** affordance instead.

---

## Licensing — non-negotiable

Every pack ships its source work's license + attribution:

- `book.json` `"license"` (SPDX id, e.g. `CC0-1.0`, `CC-BY-2.5`) + `"author"`.
- `books/<slug>/CREDITS.md` — full attribution + license text/notice.

Conversion (LaTeX/markdeep/EPUB → HTML) is a **format change, not a
modification** of the work. **Verify the license before adding anything** — if
the source header and the repo license disagree (it happens), flag it and use
the authoritative one. A `*-NC` license shows a **non-commercial badge** in the
Library (the reader is free, but bundling NC content into a sold product isn't).

---

## Where content lives

**Default: put it here, in `gcu-library`.** It's the canonical content repo +
carries the conversion tooling, and it's the registry's baked-in default source.
Heavy, externally-sourced, license-laden content stays out of the lean
`auditable` repo. Only stand up your *own* registry elsewhere if you have a
reason to (private content, a different org) — see `REGISTRY.md`.

See `README.md` for the repo layout + the `datKind`/`tags` organization
convention as content diversifies.

## Adding a new kind (beyond books)

`kind` in `gcudat.json` routes to a consumer handler in auditable
(`works/js/gcudat-install.js` → `KIND_HANDLERS`). To add e.g. a `datasets`
kind: (1) put packs under a `datasets/<slug>/` dir here with a `gcudat.json`
(`build-registry.mjs` already scans all content roots), (2) add a
`KIND_HANDLERS.datasets` in auditable that writes the files where that kind
belongs, (3) optionally add a converter in `tools/`. The registry + `pkg
search` are kind-agnostic; only the install destination is kind-specific.
