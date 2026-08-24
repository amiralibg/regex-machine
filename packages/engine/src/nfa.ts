/**
 * Thompson construction to an NFA with explicit-priority edges.
 *
 * Priority = order of a state's out-transition list; the VM tries them in
 * order and backtracks in reverse, which reproduces JS leftmost-first
 * semantics (alternation top-to-bottom, greedy loops before exits).
 *
 * Non-regular features get special transition kinds:
 * - backreferences → `backref` transitions (runtime-checked against captures)
 * - lookaround     → `gateEnter` transitions into independent sub-NFAs (gates)
 */

import type { AnchorKind, ClassItem, Node } from './ast';

export type NodeId = number;

export type ConsumeMatcher =
  | { t: 'unit'; cu: number; fold: boolean }
  | { t: 'pair'; hi: number; lo: number }
  | { t: 'class'; items: ClassItem[]; negated: boolean; fold: boolean }
  | { t: 'dot'; dotAll: boolean };

export type Trans =
  | { kind: 'consume'; matcher: ConsumeMatcher; target: NodeId }
  | { kind: 'epsilon'; target: NodeId }
  | { kind: 'assert'; check: AnchorKind; multiline: boolean; target: NodeId }
  | { kind: 'captureOpen'; group: number; target: NodeId }
  | { kind: 'captureClose'; group: number; target: NodeId }
  /**
   * Marks loop-body entry: records current position (+ undo log length).
   * Paired with `loopGuard` to implement the JS "stop on empty iteration"
   * rule, including rolling back the empty iteration's captures.
   */
  | { kind: 'loopEnter'; loopId: number; target: NodeId }
  /**
   * Empty iteration ⇒ path fails (rolled back). Progress ⇒ move to
   * contTarget now, registering altNode's edge as a backtrack choice point.
   * Greedy loops: cont=next iteration, alt=exit. Lazy: reversed.
   * altNode null = no fallback (bounded optional copies).
   */
  | { kind: 'loopGuard'; loopId: number; contTarget: NodeId; altNode: NodeId | null }
  | { kind: 'backref'; group: number; fold: boolean; target: NodeId }
  /** Lookaround gate: verdict decides whether the main thread proceeds. */
  | { kind: 'gateEnter'; gateIdx: number; target: NodeId };

export interface Gate {
  /** independent sub-machine for the lookaround body */
  nfa: Nfa;
  kind: 'ahead' | 'behind';
  polarity: boolean;
}

export interface Nfa {
  /** states[i] is the priority-ordered out-transition list of state i */
  states: Trans[][];
  start: NodeId;
  accept: NodeId;
  gates: Gate[];
  numGroups: number;
  /** total loop ids allocated across this machine and its gates */
  loopsTotal: number;
}

export interface Flags {
  ignoreCase: boolean;
  global: boolean;
  multiline: boolean;
  dotAll: boolean;
}

export function parseFlags(src: string): Flags {
  const seen = new Set<string>();
  for (const c of src) {
    if (!'igms'.includes(c)) {
      throw new Error(`Unsupported flag "${c}" (supported: i, g, m, s)`);
    }
    if (seen.has(c)) throw new Error(`Duplicate flag "${c}"`);
    seen.add(c);
  }
  return {
    ignoreCase: seen.has('i'),
    global: seen.has('g'),
    multiline: seen.has('m'),
    dotAll: seen.has('s'),
  };
}

/** Case-insensitive comparison on single code units. */
export function foldEq(a: number, b: number): boolean {
  if (a === b) return true;
  const sa = String.fromCharCode(a);
  const sb = String.fromCharCode(b);
  return sa.toLowerCase() === sb.toLowerCase() || sa.toUpperCase() === sb.toUpperCase();
}

const WORD = new Set([
  ...('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'.split('').map((c) => c.charCodeAt(0))),
]);

export function isWordChar(cu: number): boolean {
  return WORD.has(cu);
}

export function isLineTerminator(cu: number): boolean {
  return cu === 0x0a || cu === 0x0d || cu === 0x2028 || cu === 0x2029;
}

function classMatchesItems(items: ClassItem[], cu: number, fold: boolean): boolean {
  const candidates = fold ? foldVariants(cu) : [cu];
  for (const item of items) {
    for (const c of candidates) {
      switch (item.t) {
        case 'char':
          if (c === item.cu) return true;
          break;
        case 'range':
          if (c >= item.lo && c <= item.hi) return true;
          break;
        case 'klass': {
          const hit =
            item.kind === 'd'
              ? c >= 48 && c <= 57
              : item.kind === 's'
                ? isSpace(c)
                : isWordChar(c);
          if (hit !== item.negated) return true;
          break;
        }
      }
    }
  }
  return false;
}

function foldVariants(cu: number): number[] {
  const s = String.fromCharCode(cu);
  const out = new Set<number>([cu]);
  const lc = s.toLowerCase();
  const uc = s.toUpperCase();
  if (lc.length === 1) out.add(lc.charCodeAt(0));
  if (uc.length === 1) out.add(uc.charCodeAt(0));
  return [...out];
}

function isSpace(cu: number): boolean {
  return (
    cu === 0x09 ||
    cu === 0x0a ||
    cu === 0x0b ||
    cu === 0x0c ||
    cu === 0x0d ||
    cu === 0x20 ||
    cu === 0xa0 ||
    cu === 0x1680 ||
    (cu >= 0x2000 && cu <= 0x200a) ||
    cu === 0x2028 ||
    cu === 0x2029 ||
    cu === 0x202f ||
    cu === 0x205f ||
    cu === 0x3000 ||
    cu === 0xfeff
  );
}

/** Test a consume matcher against input at pos. Returns new position or -1. */
export function matchConsume(
  m: ConsumeMatcher,
  input: string,
  pos: number,
): number {
  if (m.t === 'pair') {
    if (pos + 1 >= input.length) return -1;
    return input.charCodeAt(pos) === m.hi && input.charCodeAt(pos + 1) === m.lo ? pos + 2 : -1;
  }
  if (pos >= input.length) return -1;
  const cu = input.charCodeAt(pos);
  let ok: boolean;
  switch (m.t) {
    case 'unit':
      ok = m.fold ? foldEq(cu, m.cu) : cu === m.cu;
      break;
    case 'class':
      ok = classMatchesItems(m.items, cu, m.fold) !== m.negated;
      break;
    case 'dot':
      ok = m.dotAll || !isLineTerminator(cu);
      break;
  }
  return ok ? pos + 1 : -1;
}

class Builder {
  readonly states: Trans[][] = [];

  constructor(
    private readonly flags: Flags,
    /** shared across the whole pattern (incl. gate sub-machines) so loop ids stay unique */
    private readonly loopPool: { next: number },
  ) {}

  newState(): NodeId {
    this.states.push([]);
    return this.states.length - 1;
  }

  connect(from: NodeId, tr: Trans): void {
    this.states[from]!.push(tr);
  }

  eps(from: NodeId, to: NodeId): void {
    this.connect(from, { kind: 'epsilon', target: to });
  }

  get fold(): boolean {
    return this.flags.ignoreCase;
  }

  nextLoopId(): number {
    return this.loopPool.next++;
  }

  /**
   * Unbounded repetition with the empty-iteration guard.
   * `skip` adds the zero-iteration exit edge (false for `x+`, true for `x*`).
   */
  starLike(makeBody: () => { start: NodeId; end: NodeId }, greedy: boolean, skip: boolean): { start: NodeId; end: NodeId } {
    const s = this.newState();
    const entry = this.newState();
    const e = this.newState();
    const loopId = this.nextLoopId();

    // priority edges: greedy tries another iteration first, lazy prefers exit
    if (greedy) {
      this.eps(s, entry);
      if (skip) this.eps(s, e);
    } else {
      if (skip) this.eps(s, e);
      this.eps(s, entry);
    }
    this.connect(entry, { kind: 'loopEnter', loopId, target: -1 });
    const body = makeBody();
    // fix entry target now that body exists
    const entryOut = this.states[entry]!;
    (entryOut[entryOut.length - 1]! as { target: number }).target = body.start;
    // After each iteration: greedy continues into another round and keeps
    // "exit" as its backtrack option; lazy does the reverse. An EMPTY
    // iteration registers neither — the path just fails, so backtracking
    // unwinds into the body's own remaining alternatives.
    const altExit = (): NodeId => {
      const n = this.newState();
      this.eps(n, e);
      return n;
    };
    const altEntry = (): NodeId => {
      const n = this.newState();
      this.eps(n, entry);
      return n;
    };
    if (greedy) {
      this.connect(body.end, { kind: 'loopGuard', loopId, contTarget: entry, altNode: altExit() });
    } else {
      this.connect(body.end, { kind: 'loopGuard', loopId, contTarget: e, altNode: altEntry() });
    }
    return { start: s, end: e };
  }

  optional(makeBody: () => { start: NodeId; end: NodeId }, greedy: boolean): { start: NodeId; end: NodeId } {
    const s = this.newState();
    const e = this.newState();
    // empty-iteration check applies to optional copies too (min already met)
    const entry = this.newState();
    const loopId = this.nextLoopId();
    this.connect(entry, { kind: 'loopEnter', loopId, target: -1 });
    const body = makeBody();
    {
      const entryOut = this.states[entry]!;
      (entryOut[entryOut.length - 1]! as { target: number }).target = body.start;
    }
    // progress passes through to e; empty ⇒ blocked (min already met).
    // No fallback: repetition comes from sibling copies' skip edges.
    const guard: Trans = { kind: 'loopGuard', loopId, contTarget: e, altNode: null };
    if (greedy) {
      this.eps(s, entry);
      this.eps(s, e);
    } else {
      this.eps(s, e);
      this.eps(s, entry);
    }
    this.connect(body.end, guard);
    return { start: s, end: e };
  }
}

interface Ctx {
  flags: Flags;
  loopPool: { next: number };
}

function compileNode(n: Node, b: Builder, ctx: Ctx): { start: NodeId; end: NodeId } {
  switch (n.type) {
    case 'sequence': {
      if (n.parts.length === 0) {
        const s = b.newState();
        return { start: s, end: s };
      }
      let acc = compileNode(n.parts[0]!, b, ctx);
      for (let k = 1; k < n.parts.length; k++) {
        const f = compileNode(n.parts[k]!, b, ctx);
        b.eps(acc.end, f.start);
        acc = { start: acc.start, end: f.end };
      }
      return acc;
    }
    case 'alternation': {
      const s = b.newState();
      const e = b.newState();
      for (const branch of n.branches) {
        const f = compileNode(branch, b, ctx);
        b.eps(s, f.start); // priority = declaration order
        b.eps(f.end, e);
      }
      return { start: s, end: e };
    }
    case 'literal': {
      const st = b.newState();
      const en = b.newState();
      if (n.units.length === 1) {
        b.connect(st, { kind: 'consume', matcher: { t: 'unit', cu: n.units[0]!, fold: b.fold }, target: en });
      } else {
        b.connect(st, { kind: 'consume', matcher: { t: 'pair', hi: n.units[0]!, lo: n.units[1]! }, target: en });
      }
      return { start: st, end: en };
    }
    case 'charClass': {
      const st = b.newState();
      const en = b.newState();
      b.connect(st, {
        kind: 'consume',
        matcher: { t: 'class', items: n.items, negated: n.negated, fold: b.fold },
        target: en,
      });
      return { start: st, end: en };
    }
    case 'dot': {
      const st = b.newState();
      const en = b.newState();
      b.connect(st, { kind: 'consume', matcher: { t: 'dot', dotAll: ctx.flags.dotAll }, target: en });
      return { start: st, end: en };
    }
    case 'anchor': {
      const st = b.newState();
      const en = b.newState();
      b.connect(st, { kind: 'assert', check: n.kind, multiline: ctx.flags.multiline, target: en });
      return { start: st, end: en };
    }
    case 'backref': {
      const st = b.newState();
      const en = b.newState();
      b.connect(st, { kind: 'backref', group: n.index, fold: b.fold, target: en });
      return { start: st, end: en };
    }
    case 'group': {
      if (n.kind === 'capture') {
        const g = n.index!;
        const st = b.newState();
        const openSt = b.newState();
        const en = b.newState();
        b.connect(st, { kind: 'captureOpen', group: g, target: openSt });
        const body = compileNode(n.body, b, ctx);
        b.eps(openSt, body.start);
        const closeSt = b.newState();
        b.eps(body.end, closeSt);
        b.connect(closeSt, { kind: 'captureClose', group: g, target: en });
        return { start: st, end: en };
      }
      if (n.kind === 'nonCapture') {
        return compileNode(n.body, b, ctx);
      }
      // lookaround → gate
      const sub = buildNfaInto(n.body, ctx.flags, ctx.loopPool);
      const gateIdx = currentGates(ctx).length;
      currentGates(ctx).push({
        nfa: sub,
        kind: n.kind === 'lookahead' || n.kind === 'negativeLookahead' ? 'ahead' : 'behind',
        polarity: n.kind === 'lookahead' || n.kind === 'lookbehind',
      });
      const st = b.newState();
      const en = b.newState();
      b.connect(st, { kind: 'gateEnter', gateIdx, target: en });
      return { start: st, end: en };
    }
    case 'quantifier': {
      const { min, max, greedy } = n;
      // chain `min` mandatory copies
      let start: NodeId | null = null;
      let cur: NodeId | null = null;
      for (let k = 0; k < min; k++) {
        const f = compileNode(n.child, b, ctx);
        if (cur === null) {
          start = f.start;
        } else {
          b.eps(cur, f.start);
        }
        cur = f.end;
      }
      if (max === Infinity) {
        // mandatory copies already satisfy min ⇒ the tail may always skip,
        // which gives lazy quantifiers their prefer-exit choice point
        const star = b.starLike(() => compileNode(n.child, b, ctx), greedy, true);
        if (cur === null) return star;
        b.eps(cur, star.start);
        return { start: start!, end: star.end };
      }
      const extra = max - min;
      if (extra === 0) {
        if (cur === null) {
          const s = b.newState();
          return { start: s, end: s };
        }
        return { start: start!, end: cur };
      }
      // chain of `extra` optional copies
      const opts = [];
      for (let k = 0; k < extra; k++) {
        opts.push(b.optional(() => compileNode(n.child, b, ctx), greedy));
      }
      for (let k = 0; k < opts.length - 1; k++) {
        b.eps(opts[k]!.end, opts[k + 1]!.start);
      }
      const lastOptEnd = opts[opts.length - 1]!.end;
      if (cur === null) return { start: opts[0]!.start, end: lastOptEnd };
      b.eps(cur, opts[0]!.start);
      return { start: start!, end: lastOptEnd };
    }
  }
}

// Gates live on the NFA currently being built; threaded through ctx.
const gatesByCtx = new WeakMap<Ctx, Gate[]>();
function currentGates(ctx: Ctx): Gate[] {
  let g = gatesByCtx.get(ctx);
  if (!g) {
    g = [];
    gatesByCtx.set(ctx, g);
  }
  return g;
}

export function buildNfaInto(root: Node, flags: Flags, loopPool = { next: 0 }): Nfa {
  const ctx: Ctx = { flags, loopPool };
  const b = new Builder(flags, loopPool);
  const frag = compileNode(root, b, ctx);
  const accept = b.newState();
  b.eps(frag.end, accept);
  return {
    states: b.states,
    start: frag.start,
    accept,
    gates: gatesByCtx.get(ctx) ?? [],
    numGroups: 0, // filled by caller
    loopsTotal: 0, // filled by caller
  };
}

export function buildNfa(root: Node, flags: Flags, numGroups: number): Nfa {
  const pool = { next: 0 };
  const nfa = buildNfaInto(root, flags, pool);
  nfa.numGroups = numGroups;
  nfa.loopsTotal = pool.next;
  return nfa;
}
