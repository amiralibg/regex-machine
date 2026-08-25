# regex-machine

A regex state machine playground. Paste a pattern and an input, and it compiles
the pattern into a visible NFA (or DFA) and animates your input walking through
the machine, backtracking included.

regex101 shows you *what* matched. This shows you *why*: which states the
machine visited, where it guessed, and exactly which steps it unwound when a
guess failed.

## Features

- **NFA and DFA views.** Every pattern compiles to a state graph you can hover,
  with epsilon transitions drawn distinctly. Toggle to the DFA when the pattern
  is a regular language.
- **Bidirectional highlighting.** Hover an edge to light up the part of the
  pattern that built it. Hover the pattern to light up every edge it produced.
  Powered by source spans carried on every AST node.
- **Trace playback.** Step, scrub, or play the matcher run. Backtracks render
  explicitly, with a running step counter.
- **ReDoS detection with proof.** The static analyzer flags nested quantifiers
  that can blow up, then measures actual step growth on a log-scale chart so
  you can see the exponential curve for yourself.
- **Interactive course.** Five modules that end in the playground, because
  reading about backtracking is nothing like watching it rewind.
- **Non-regular features, honestly rendered.** Backreferences and lookaround
  appear as annotated special edges and gate nodes with inspectable
  sub-machines. The DFA toggle explains itself when it's disabled.
- **Permalinks.** The URL fragment holds your pattern, flags, input, and view.

## Correctness

The engine is verified by differential testing against native `RegExp`: the
suite generates hundreds of pattern/input pairs and asserts identical results
for match, match index, and every capture group, named ones included.

## Stack

- pnpm workspaces, TypeScript (strict)
- `packages/engine` — tokenizer, AST, NFA construction, backtracking VM, trace.
  Zero React, zero DOM. A standalone library that happens to have a UI.
- `packages/web` — Vite + React visualization. ELK handles graph layout; the
  SVG rendering is hand-written.
- Vitest for tests.

## Development

```sh
pnpm install
pnpm dev            # web dev server
pnpm test           # all tests, including the differential suite
pnpm --filter engine test
```

## Deploy with Docker

Builds the static site and serves it from nginx:

```sh
docker compose up -d --build
```

The app is then on port 8088. Change the mapping in `docker-compose.yml` to
taste. The image is multi-stage (node build, nginx serve) and ends up at a few
megabytes. On Dokploy, point the app at the repo root with this Dockerfile and
set the port to 80.
