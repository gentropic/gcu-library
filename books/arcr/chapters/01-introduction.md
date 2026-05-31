# arcr / gewgaw — a micro-game DSL

**arcr** is a tiny language for one-screen arcade micro-games — small enough that a
whole game fits in a QR code, regular enough that a language model can write valid
games at volume, and sandboxed by construction: the program is *data*, never code.
**gewgaw** is its reference engine. This manual is how you read and write them.

A complete game is a handful of lines:

```
@title STARGAZING
@about calm
@bg stars
obj you : emoji 🧺 at=bottom move=tap
every 0.9 : spawn emoji ⭐ at=top move=fall tag=star
on hit you #star : score +1
when score >= 12 : win "a basket of light. enough."
```

Steer the basket, catch the stars, win at twelve. That's the whole grammar in
miniature: **objects** (an emoji, some text, a shape, a procedural sprite) and
**rules** of the shape *event → condition → action*. The engine supplies all the
juice — the catch-pop, the chime, the hurt-shake, the title card, the result
screen — so the author writes only intent.

## Where it runs: capsules and cradle

arcr is one rung of a small stack for shipping self-contained payloads through a
static origin — no backend, content-addressed, offline.

- A **capsule** is a compact string that resolves to bytes — small enough for a URL
  fragment or a QR code. A whole arcr game, deflate-compressed against a shared
  dictionary, typically lands around ~130 bytes: it fits on a one-inch sticker.
- **cradle** is a static bootloader that resolves a capsule → bytes → reads a
  magic-byte line (`!arcr1+…`) → dispatches to a **curated, built-in** renderer.
  No third-party code ever runs. The arcr renderer (the gewgaw engine) is one of
  those built-ins.

So a game travels as a tiny capsule, and *one capsule is one game*. The motivating
image is a **gacha machine**: turn the crank, out drops a capsule, scan the QR on
the card inside, and a unique little game boots — offline, instantly, forever.

## Two names: a family and an engine

- **`arcr`** is the format *family* — the thing the magic line `!arcr<version>+…`
  names. It's a contract: *here is a micro-game; render it.*
- **`gewgaw`** is the reference *engine* that does the rendering. It owns the entire
  experience — physics-lite motion, particles, screen-shake, WebAudio cues, the
  seeded RNG, the result screen. Other engines (3D, gamepad, …) could one day join
  the family under their own magic-line version; gewgaw is the one documented here.

The split matters for trust. **The program is untrusted data — the DSL is the
sandbox.** There is no `eval`, no DOM access, no network; a malformed or hostile
game can't do anything worse than be a bad game (and the engine degrades around
unknown lines rather than crashing). That's what lets a stranger's QR code run on
your phone safely.

## The design stance

Three commitments shape every decision, and they're worth holding in mind as you
read:

1. **Expressive range over mechanical depth.** A small vocabulary that spans a wide
   *conceptual* space — catch, dodge, whack, transform, wait, refuse, shoot, take
   a chance — rather than a deep physics engine. A "game" may be one line of text
   that declines to be played.
2. **The engine owns the juice; the author owns the intent.** You never position a
   pixel or schedule a sound. You say `score +1` and the engine pops, chimes, and
   ramps difficulty for free.
3. **Deterministic and seeded.** A given capsule plus its seed plays back
   *identically*, frame for frame, on any device — the only nondeterminism is human
   input timing. Randomness (`chance`, spawn jitter) draws from a seeded stream, so
   surprise is reproducible. This is what makes "this QR *is* this game" true.

The aesthetic is unapologetically neo-dada: games that are calm, or cruel, or
pointless on purpose; a refusal that's the whole point; a meta-joke that knows it's
a cartridge. The vocabulary is chosen to make those as easy to write as a catch
game.

## How to read this manual

- **The Cookbook** comes next. It's example-first and meant to be read start to
  finish: the mental model, the full vocabulary in one compact table, then a
  pattern library of complete games across genres, the make-it-fun levers, and a
  validity checklist. It doubles as the few-shot material an LLM is prompted with —
  humans and models author the same way. Start here.
- **The Specification** is the normative reference: the exact grammar, the
  execution model, the engine contract, the safety bounds, and how a game is
  packaged into a capsule. Reach for it when you need the precise rule.

Every game example in both chapters is checked by the project's test suite — it
parses clean and plays to an ending — so what you read is what runs.

---

*arcr and gewgaw are part of the GCU stack. The living source, the engine, the
authoring tools, and the QR factory are at
[github.com/gentropic/cradle](https://github.com/gentropic/cradle).*
