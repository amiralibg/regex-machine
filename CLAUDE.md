# regex-machine

A regex state machine playground: compiles a pattern to a visible NFA/DFA and
animates input walking through it, backtracking included. regex101 shows *what*
matched; this shows *why*.

## Stack

- pnpm workspaces, TypeScript (strict)
- Vite + React (`packages/web`)
- `elkjs` for graph layout, hand-written SVG rendering
- Vitest
- Static build, no server

## Packages

- `packages/engine` — tokenizer, AST, NFA, backtracking VM, trace. **Zero React,
  zero DOM dependencies. It is a standalone library that happens to have a UI.**
- `packages/web` — visualization only. Never imports engine internals; only the
  public API from `packages/engine/src/index.ts`.

## Commands

```sh
pnpm install
pnpm test          # run all tests (Vitest)
pnpm --filter engine test
pnpm dev           # web dev server
```

## Non-negotiable rules

1. **Engine correctness is verified by differential testing against native
   `RegExp`.** The suite in `packages/engine/test/differential.test.ts`
   generates hundreds of pattern/input pairs and asserts identical results
   (match, match index, every capture group including named ones).
2. **No visualization work proceeds while those tests are red.** A beautiful
   visualization of a wrong engine is worse than nothing.
3. Every AST node carries a source span from day one. Never retrofit spans.
4. Commit at phase boundaries.

## Phases

1. Engine correctness (differential suite green) — DONE gate
2. Graph rendering (ELK NFA layout, epsilon transitions distinct, DFA toggle)
3. Bidirectional pattern↔graph highlighting via source spans
4. Trace playback with explicit backtrack rendering + step counter
5. ReDoS static analysis + step-count blow-up chart

Non-regular features (backreferences, lookaround) are modeled as annotated
special transitions / gate nodes with sub-machine insets; the DFA toggle is
disabled for such patterns with an explanatory message.
