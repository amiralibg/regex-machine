/**
 * Subset construction over the priority NFA — the DFA view's data source.
 *
 * Epsilon-family transitions (epsilon, capture open/close, loop enter/guard)
 * collapse; consume matchers and assertions become alphabet symbols keyed by
 * their structural identity. States are sets of NFA nodes.
 *
 * Deliberate approximation: distinct matchers that overlap (e.g. `[ab]` vs
 * `a`) stay separate parallel edges instead of being split into disjoint
 * character intervals. The rendered graph stays faithful to the machine;
 * only strict determinism across overlapping classes is relaxed. Patterns
 * with backreferences or lookaround are NOT determinable at all — use
 * `isRegularNfa` to gate the DFA toggle in the UI.
 */

import type { AnchorKind, ClassItem } from './ast';
import { checkAssert, matchConsume } from './nfa';
import type { ConsumeMatcher, Nfa } from './nfa';

export type DfaSym =
  | { t: 'consume'; matcher: ConsumeMatcher }
  | { t: 'assert'; check: AnchorKind; multiline: boolean };

export interface DfaEdge {
  from: number;
  to: number;
  sym: DfaSym;
  /** structural identity — edges sharing a key came from one symbol class */
  key: string;
  label: string;
}

export interface Dfa {
  /** state 0 is the start state */
  states: { id: number; accepting: boolean }[];
  edges: DfaEdge[];
}

/** True when the machine uses no backreferences and no lookaround gates. */
export function isRegularNfa(nfa: Nfa): boolean {
  for (const outs of nfa.states) {
    for (const tr of outs) {
      if (tr.kind === 'backref' || tr.kind === 'gateEnter') return false;
    }
  }
  return true;
}

function classItemKey(item: ClassItem): string {
  switch (item.t) {
    case 'char':
      return `c${item.cu}`;
    case 'range':
      return `r${item.lo}-${item.hi}`;
    case 'klass':
      return `${item.negated ? 'N' : 'n'}${item.kind}`;
  }
}

export function matcherKey(m: ConsumeMatcher): string {
  switch (m.t) {
    case 'unit':
      return `u:${m.cu}:${m.fold ? 1 : 0}`;
    case 'pair':
      return `p:${m.hi}:${m.lo}`;
    case 'class':
      return `k[${m.items.map(classItemKey).join(',')}]:${m.negated ? 1 : 0}:${m.fold ? 1 : 0}`;
    case 'dot':
      return `d:${m.dotAll ? 1 : 0}`;
  }
}

/** Human-readable label for a consume matcher (also used by the UI). */
export function matcherLabel(m: ConsumeMatcher): string {
  const printable = (cu: number): string => {
    const s = String.fromCharCode(cu);
    return /[a-zA-Z0-9]/.test(s) ? s : `\\u{${cu.toString(16)}}`;
  };
  switch (m.t) {
    case 'unit':
      return m.fold ? printable(m.cu) : printable(m.cu);
    case 'pair':
      return printable(m.hi) + printable(m.lo);
    case 'class': {
      // a single shorthand (\d \w \s) reads better without brackets
      const only = m.items.length === 1 ? m.items[0] : undefined;
      if (!m.negated && only && only.t === 'klass' && !only.negated) {
        return `\\${only.kind}`;
      }
      const body = m.items
        .map((it) =>
          it.t === 'char'
            ? printable(it.cu)
            : it.t === 'range'
              ? `${printable(it.lo)}-${printable(it.hi)}`
              : `\\${it.negated ? it.kind.toUpperCase() : it.kind}`,
        )
        .join('');
      return `[${m.negated ? '^' : ''}${body}]`;
    }
    case 'dot':
      return '.';
  }
}

export function symLabel(sym: DfaSym): string {
  return sym.t === 'consume' ? matcherLabel(sym.matcher) : anchorLabel(sym.check);
}

function anchorLabel(check: AnchorKind): string {
  switch (check) {
    case 'lineStart':
      return '^';
    case 'lineEnd':
      return '$';
    case 'wordBoundary':
      return '\\b';
    case 'nonWordBoundary':
      return '\\B';
  }
}

function assertKey(check: AnchorKind, multiline: boolean): string {
  return `a:${check}:${multiline ? 1 : 0}`;
}

type SymTrans = { kind: 'sym'; sym: DfaSym; key: string };

/**
 * Symbol transition out of an NFA node (with its forward target), if any.
 * Epsilon-family transitions (incl. loop guards) return null.
 */
function symbolOf(tr: Nfa['states'][number][number]): { info: SymTrans; target: number } | null {
  switch (tr.kind) {
    case 'consume':
      return { info: { kind: 'sym', sym: { t: 'consume', matcher: tr.matcher }, key: matcherKey(tr.matcher) }, target: tr.target };
    case 'assert':
      return {
        info: { kind: 'sym', sym: { t: 'assert', check: tr.check, multiline: tr.multiline }, key: assertKey(tr.check, tr.multiline) },
        target: tr.target,
      };
    default:
      return null;
  }
}

/** Forward targets of epsilon-family transitions; empty for symbols. */
function epsTargets(tr: Nfa['states'][number][number]): number[] {
  switch (tr.kind) {
    case 'epsilon':
    case 'captureOpen':
    case 'captureClose':
    case 'loopEnter':
      return [tr.target];
    case 'loopGuard':
      // both continuations exist language-wise (VM picks via priority)
      return tr.altNode !== null ? [tr.contTarget, tr.altNode] : [tr.contTarget];
    default:
      return [];
  }
}

function epsilonClosure(nfa: Nfa, seeds: Iterable<number>): Set<number> {
  const out = new Set<number>();
  const work = [...seeds];
  while (work.length > 0) {
    const n = work.pop()!;
    if (out.has(n)) continue;
    out.add(n);
    for (const tr of nfa.states[n] ?? []) {
      for (const t of epsTargets(tr)) {
        if (!out.has(t)) work.push(t);
      }
    }
  }
  return out;
}

const closureId = (nodes: Set<number>): string => [...nodes].sort((a, b) => a - b).join(',');

export function buildDfa(nfa: Nfa): Dfa {
  const start = epsilonClosure(nfa, [nfa.start]);
  const ids = new Map<string, number>([[closureId(start), 0]]);
  const states: Dfa['states'] = [{ id: 0, accepting: start.has(nfa.accept) }];
  const edges: DfaEdge[] = [];
  const queue: Set<number>[] = [start];

  for (let qi = 0; qi < queue.length; qi++) {
    const current = queue[qi]!;
    const from = ids.get(closureId(current))!;

    // collect symbol moves across the whole closure, unioned per key
    const moves = new Map<string, { sym: DfaSym; targets: Set<number> }>();
    for (const n of current) {
      for (const tr of nfa.states[n] ?? []) {
        const st = symbolOf(tr);
        if (st === null) continue;
        const entry = moves.get(st.info.key);
        if (entry) {
          entry.targets.add(st.target);
        } else {
          moves.set(st.info.key, { sym: st.info.sym, targets: new Set([st.target]) });
        }
      }
    }

    for (const [key, { sym, targets }] of moves) {
      const closure = epsilonClosure(nfa, targets);
      const cid = closureId(closure);
      let to = ids.get(cid);
      if (to === undefined) {
        to = states.length;
        ids.set(cid, to);
        states.push({ id: to, accepting: closure.has(nfa.accept) });
        queue.push(closure);
      }
      edges.push({ from, to, sym, key, label: symLabel(sym) });
    }
  }

  return { states, edges };
}

/**
 * Can a match start at `pos` (consuming any prefix)? Language membership of
 * input.slice(pos) — used for differential checks and cheap previews.
 */
export function dfaMatchesAt(dfa: Dfa, input: string, pos: number): boolean {
  const accepts = (states: Set<number>): boolean => [...states].some((s) => dfa.states[s]!.accepting);

  /** transitively traverse assertion edges that hold at `at` */
  const assertClosure = (states: Set<number>, at: number): Set<number> => {
    const out = new Set<number>(states);
    let grew = true;
    while (grew) {
      grew = false;
      for (const s of [...out]) {
        for (const e of dfa.edges) {
          if (e.from !== s || out.has(e.to)) continue;
          if (e.sym.t === 'assert' && checkAssert(e.sym.check, e.sym.multiline, input, at)) {
            out.add(e.to);
            grew = true;
          }
        }
      }
    }
    return out;
  };

  let current = assertClosure(new Set([0]), pos);
  if (accepts(current)) return true;
  for (let i = pos; i < input.length; i++) {
    const moved = new Set<number>();
    for (const s of current) {
      for (const e of dfa.edges) {
        if (e.from !== s) continue;
        if (e.sym.t === 'consume' && matchConsume(e.sym.matcher, input, i) >= 0) moved.add(e.to);
      }
    }
    if (moved.size === 0) return false;
    current = assertClosure(moved, i + 1);
    if (accepts(current)) return true;
  }
  return false;
}
