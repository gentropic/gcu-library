# Making a content registry for the GCU

A **registry** is a single `registry.json` catalog that lets Auditable Works
**browse + install** content packs (`.gcudat`) and code extensions (`.gcupkg`)
from a URL. This repo *is* the reference registry (the baked-in default source),
but **any repo or host can serve one** — this guide is how.

> Most of the time you don't need your own registry: **add your content here, in
> `gcu-library`** (see `AUTHORING.md`). Stand up your own only for private
> content, a different org, or a separate distribution channel.

---

## `registry.json`

```json
{
  "registry": 1,
  "name": "GCU Library",
  "description": "Prepared books and data packs from the Geoscientific Chaos Union.",
  "homepage": "https://github.com/gentropic/gcu-library",
  "updated": "2026-05-31",
  "entries": [
    {
      "name": "rtnw",                 // unique id (matches the pack manifest name)
      "kind": "gcudat",               // "gcudat" (data) | "gcupkg" (code extension)
      "datKind": "books",             // for gcudat: the pack kind (drives the Library icon/filter)
      "title": "Ray Tracing: The Next Week",
      "description": "",
      "version": "1.0.1",             // semver — drives update detection
      "license": "CC0-1.0",
      "attribution": "Peter Shirley, …",
      "size": 5422849,                // bytes of the artifact
      "url": "dist/rtnw.gcudat",      // relative to this file, or an absolute URL
      "integrity": "sha256-…",        // SRI over the artifact bytes
      "tags": ["graphics", "tutorial"],
      "cover": "covers/rtnw.png"      // optional, relative or absolute (UI thumbnail)
    }
  ]
}
```

- **`url`** resolves relative to the registry.json's own URL, or may be
  absolute (`https://…`). Arrays are allowed as mirrors.
- **`integrity`** is `sha256-<base64>` over the artifact bytes — verified on
  install (permissive: a mismatch prompts, doesn't hard-block).
- **`version`** is the heart of updates: the reader records the installed
  version in its ledger and compares against this.
- **`kind: gcupkg`** entries are **code** — the installer always shows a trust
  confirm regardless of source trust. `gcudat` is inert (lower-trust).

The producer `tools/build-registry.mjs` generates this from `dist/*.gcudat`
(computing `size` + `integrity`, reading metadata from each pack's
`gcudat.json`). It scans all content roots, so any `kind` registers without
code changes.

---

## Hosting

The only hard requirement is **CORS** — Works fetches `registry.json` and the
artifacts cross-origin, so the host must send `Access-Control-Allow-Origin: *`
(or echo the origin).

- **`raw.githubusercontent.com`** sends `ACAO: *` — commit `registry.json` +
  `dist/*.gcudat` and point at
  `https://raw.githubusercontent.com/<org>/<repo>/<branch>/registry.json`. No
  Pages/CI needed. (This is how gcu-library's default source works.)
- **GitHub Pages**, S3, any static host with permissive CORS also work.
- **Commit the artifacts.** The registry serves `dist/*.gcudat` by URL — if
  they're gitignored/unpushed, the entry URLs 404. (gcu-library's `.gitignore`
  keeps `dist/*.gcudat` deliberately.)

A source URL can point straight at a `registry.json`, or at a directory holding
one (Works appends `/registry.json`).

---

## How it's consumed

Works treats registries as **user-addable sources** (not walled):

- **Tools → Library** (surface) / **File → Browse Library…** (dialog) — pick a
  source, browse/filter, Install / Update ↑ / Reinstall. **+ Add source**
  prompts a one-time **trust warning** (a source can serve code).
- **geas `pkg`** in a terminal: `pkg search [query]`, `pkg sources`, `pkg
  install <name>`. Installing a code extension by name delegates to the shell
  (full install + the same ledger as the GUI); books redirect to the Library.
- Sources persist in shell meta; one **removable default** ships
  (gcu-library). Add yours with **+ Add source** or `RegistryAddSource`.

Trust gradient (lightest → heaviest friction): trusted-source pointer ≈ inline
data `gcudat` < unknown source < code `gcupkg` (always confirmed).

---

## Make your own — checklist

1. Author packs (`AUTHORING.md`) — or for code, build `.gcupkg`s.
2. Put built artifacts where they'll be served (e.g. `dist/`), **committed**.
3. Generate `registry.json` (adapt `tools/build-registry.mjs`) with correct
   `size` + `integrity` per artifact.
4. Host with permissive CORS (raw GitHub is easiest).
5. In Works: **+ Add source** → your `registry.json` URL → accept the trust
   prompt. Your entries appear in the Library + `pkg search`.

The canonical design (threat model, capsule/QR transport, futures) is in
auditable's `spec_inbox/auditable-registry-spec.md` (private); this file is the
public, pointable how-to.
