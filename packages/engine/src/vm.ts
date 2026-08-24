/**
 * Backtracking VM. Explicit choice-point stack (no recursion except through
 * lookaround gates), an undo log for captures/loop state, and the
 * empty-iteration guard that reproduces JS quantifier semantics:
 *
 *   when the minimum iteration count of a loop is met and an iteration
 *   matched the empty string, that iteration is rolled back (captures
 *   included) and the loop exits — mirroring the ES RepeatMatcher rule.
 *
 * Emits TraceEvents when tracing is enabled; always counts steps.
 */

import type { Nfa, Gate, Trans } from './nfa';
import { checkAssert, foldEq, isLineTerminator, isWordChar, matchConsume } from './nfa';
import type { AnchorKind } from './ast';
import type { MatchResult, TraceEvent } from './trace';

export interface ExecOptions {
  /** record per-step trace events (default false) */
  trace?: boolean;
  /** bail out after this many steps (default 1e6); result carries limitExceeded */
  stepLimit?: number;
}

export interface CompiledRegex {
  pattern: string;
  flags: string;
  nfa: Nfa;
  names: Map<string, number>;
}

export type { MatchResult };

export interface SearchOutcome extends MatchResult {
  limitExceeded: boolean;
}

type Undo =
  | { slot: number; prev: number | null }
  | { loop: number; prevPos: number; prevLogLen: number };

interface Frame {
  node: number;
  pos: number;
  logLen: number;
  ti: number; // transition index to try when this frame pops
}

type RewindOutcome = 'moved' | 'exhausted' | 'limit';

type ApplyResult =
  | { r: 'moved'; node: number; pos: number }
  | { r: 'blocked' }
  | { r: 'limit' };

const BLOCKED: ApplyResult = { r: 'blocked' };
const LIMIT: ApplyResult = { r: 'limit' };
const moved = (node: number, pos: number): ApplyResult => ({ r: 'moved', node, pos });

const DEFAULT_STEP_LIMIT = 1_000_000;

type DistributeOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
type TraceInput = DistributeOmit<TraceEvent, 'i'>;

class Machine {
  readonly caps: (number | null)[];
  readonly loops: ({ pos: number; logLen: number } | null)[];
  readonly trace: TraceEvent[] | null;
  steps = 0;

  private readonly log: Undo[] = [];

  constructor(
    private readonly input: string,
    numGroups: number,
    numLoops: number,
    recordTrace: boolean,
    private readonly limit: number,
  ) {
    this.caps = new Array<number | null>(2 * (numGroups + 1)).fill(null);
    this.loops = new Array(numLoops).fill(null);
    this.trace = recordTrace ? [] : null;
  }

  emit(e: TraceInput): void {
    if (!this.trace) return;
    this.trace.push({ ...(e as object), i: this.trace.length } as TraceEvent);
  }

  truncateLog(len: number): void {
    while (this.log.length > len) {
      const u = this.log.pop()!;
      if ('slot' in u) {
        this.caps[u.slot] = u.prev;
      } else if (u.prevPos === -1) {
        this.loops[u.loop] = null;
      } else {
        this.loops[u.loop] = { pos: u.prevPos, logLen: u.prevLogLen };
      }
    }
  }

  /**
   * One anchored attempt of `nfa` starting at `startPos`.
   * `endConstraint` pins the accept position (lookbehind mode).
   * Returns accept position, or null on failure, or -1 on step-limit hit.
   */
  attempt(nfa: Nfa, startPos: number, endConstraint: number | null): number | null | -1 {
    // per-attempt choice-point stack: nested gate runs share the machine
    // (caps, log, trace, steps) but must never touch each other's frames
    const stack: Frame[] = [];
    let node = nfa.start;
    let pos = startPos;

    const rewind = (): RewindOutcome => {
      while (stack.length > 0) {
        const f = stack.pop()!;
        this.emit({ t: 'rewind', node: f.node, trans: f.ti, pos: f.pos });
        this.truncateLog(f.logLen);
        const tr = nfa.states[f.node]![f.ti]!;
        this.steps++;
        const res = this.apply(nfa, tr, f.node, f.ti, f.pos, stack);
        if (res.r === 'moved') {
          node = res.node;
          pos = res.pos;
          return 'moved';
        }
        if (res.r === 'limit') return 'limit';
      }
      return 'exhausted';
    };

    while (true) {
      if (node === nfa.accept && (endConstraint === null || pos === endConstraint)) {
        this.emit({ t: 'accept', pos });
        return pos;
      }
      if (this.steps >= this.limit) return -1;

      const outs = nfa.states[node] ?? [];
      for (let k = outs.length - 1; k >= 1; k--) {
        stack.push({ node, pos, logLen: this.log.length, ti: k });
      }

      const first = outs[0];
      if (first === undefined) {
        // dead end (includes accept-at-wrong-position under endConstraint)
        const rw = rewind();
        if (rw === 'moved') continue;
        return rw === 'limit' ? -1 : null;
      }

      this.steps++;
      const res = this.apply(nfa, first, node, 0, pos, stack);
      switch (res.r) {
        case 'moved':
          node = res.node;
          pos = res.pos;
          break;
        case 'blocked': {
          const rw = rewind();
          if (rw === 'moved') break;
          return rw === 'limit' ? -1 : null;
        }
        case 'limit':
          return -1;
      }
    }
  }

  private apply(
    nfa: Nfa,
    tr: Trans,
    fromNode: number,
    transIdx: number,
    posIn: number,
    stack: Frame[],
  ): ApplyResult {
    switch (tr.kind) {
      case 'consume': {
        const np = matchConsume(tr.matcher, this.input, posIn);
        if (np < 0) return BLOCKED;
        this.emit({ t: 'step', node: fromNode, trans: transIdx, pos: posIn, posAfter: np, consumed: true });
        return moved(tr.target, np);
      }
      case 'epsilon': {
        this.emit({ t: 'step', node: fromNode, trans: transIdx, pos: posIn, posAfter: posIn, consumed: false });
        return moved(tr.target, posIn);
      }
      case 'assert': {
        if (!checkAssert(tr.check, tr.multiline, this.input, posIn)) return BLOCKED;
        this.emit({ t: 'step', node: fromNode, trans: transIdx, pos: posIn, posAfter: posIn, consumed: false });
        return moved(tr.target, posIn);
      }
      case 'captureOpen': {
        const slot = 2 * tr.group;
        const prev = this.caps[slot] ?? null;
        this.log.push({ slot, prev });
        this.caps[slot] = posIn;
        this.emit({ t: 'capture', group: tr.group, phase: 'open', pos: posIn, prev });
        return moved(tr.target, posIn);
      }
      case 'captureClose': {
        const slot = 2 * tr.group + 1;
        const prev = this.caps[slot] ?? null;
        this.log.push({ slot, prev });
        this.caps[slot] = posIn;
        this.emit({ t: 'capture', group: tr.group, phase: 'close', pos: posIn, prev });
        return moved(tr.target, posIn);
      }
      case 'loopEnter': {
        const prev = this.loops[tr.loopId];
        this.log.push({
          loop: tr.loopId,
          prevPos: prev ? prev.pos : -1,
          prevLogLen: prev ? prev.logLen : -1,
        });
        this.loops[tr.loopId] = { pos: posIn, logLen: this.log.length };
        this.emit({ t: 'step', node: fromNode, trans: transIdx, pos: posIn, posAfter: posIn, consumed: false });
        return moved(tr.target, posIn);
      }
      case 'loopGuard': {
        const lp = this.loops[tr.loopId]!;
        if (lp !== null && posIn === lp.pos) {
          // Empty iteration once the minimum count is met ⇒ this path fails
          // (ES RepeatMatcher). No explicit rollback: unwinding is pure LIFO,
          // so pending choice points restore exactly their own watermarks —
          // an eager truncate here could unwind below frames still on the
          // stack and corrupt enclosing captures.
          return BLOCKED;
        }
        this.emit({ t: 'step', node: fromNode, trans: transIdx, pos: posIn, posAfter: posIn, consumed: false });
        if (tr.altNode !== null) {
          // a productive iteration registers its alternative (exit or another
          // round) as a backtrack choice point
          stack.push({ node: tr.altNode, pos: posIn, logLen: this.log.length, ti: 0 });
        }
        return moved(tr.contTarget, posIn);
      }
      case 'backref': {
        const st = this.caps[2 * tr.group] ?? null;
        const en = this.caps[2 * tr.group + 1] ?? null;
        if (st === null || en === null) {
          // ES: a backreference to a group that did not participate matches
          // the empty string
          this.emit({ t: 'step', node: fromNode, trans: transIdx, pos: posIn, posAfter: posIn, consumed: false });
          return moved(tr.target, posIn);
        }
        const len = en - st;
        if (!matchesAt(this.input, st, posIn, len, tr.fold)) return BLOCKED;
        this.emit({ t: 'step', node: fromNode, trans: transIdx, pos: posIn, posAfter: posIn + len, consumed: len > 0 });
        return moved(tr.target, posIn + len);
      }
      case 'gateEnter': {
        const gate = nfa.gates[tr.gateIdx]!;
        this.emit({
          t: 'gateEnter',
          gateId: fromNode,
          kind: gate.kind,
          polarity: gate.polarity,
          pos: posIn,
        });
        const capsSnapshot = this.caps.slice();
        let verdict: boolean;
        let hitLimit = false;
        if (gate.kind === 'ahead') {
          const r = this.attempt(gate.nfa, posIn, null);
          verdict = r !== null && r !== -1;
          hitLimit = r === -1;
        } else {
          // lookbehind: some match ends exactly at posIn; try longest first
          verdict = false;
          for (let s = posIn; s >= 0; s--) {
            const r = this.attempt(gate.nfa, s, posIn);
            if (r === -1) {
              hitLimit = true;
              break;
            }
            if (r !== null) {
              verdict = true;
              break;
            }
          }
        }
        if (hitLimit) return LIMIT;
        if (!gate.polarity && verdict) {
          // negative lookaround discards captures made inside
          for (let k = 0; k < capsSnapshot.length; k++) this.caps[k] = capsSnapshot[k]!;
        }
        this.emit({ t: 'gateExit', gateId: fromNode, verdict });
        return verdict === gate.polarity ? moved(tr.target, posIn) : BLOCKED;
      }
    }
  }
}

function matchesAt(input: string, from: number, at: number, len: number, fold: boolean): boolean {
  if (at + len > input.length) return false;
  for (let k = 0; k < len; k++) {
    const a = input.charCodeAt(from + k);
    const b = input.charCodeAt(at + k);
    if (!(fold ? foldEq(a, b) : a === b)) return false;
  }
  return true;
}

/**
 * Leftmost search starting at `from`. Returns the full result with trace
 * (if requested), step count, and limitExceeded flag.
 */
export function findMatch(
  compiled: CompiledRegex,
  input: string,
  from: number,
  opts: ExecOptions = {},
): SearchOutcome {
  const limit = opts.stepLimit ?? DEFAULT_STEP_LIMIT;
  const m = new Machine(
    input,
    compiled.nfa.numGroups,
    compiled.nfa.loopsTotal,
    opts.trace ?? false,
    limit,
  );
  const searchStart = Math.max(0, Math.min(from, input.length));

  for (let s = searchStart; s <= input.length; s++) {
    m.truncateLog(0);
    const end = m.attempt(compiled.nfa, s, null);
    if (end === -1) {
      return noMatch(m, true);
    }
    if (end !== null) {
      return buildMatch(m, compiled, input, s, end);
    }
  }
  m.emit({ t: 'fail' });
  return noMatch(m, false);
}

function noMatch(m: Machine, limitExceeded: boolean): SearchOutcome {
  return {
    matched: false,
    start: -1,
    end: -1,
    groups: [],
    namedGroups: {},
    stepCount: m.steps,
    trace: m.trace ?? undefined,
    limitExceeded,
  };
}

function buildMatch(
  m: Machine,
  compiled: CompiledRegex,
  input: string,
  start: number,
  end: number,
): SearchOutcome {
  const groups: (string | undefined)[] = [];
  for (let g = 1; g <= compiled.nfa.numGroups; g++) {
    const s = m.caps[2 * g] ?? null;
    const e = m.caps[2 * g + 1] ?? null;
    groups.push(s !== null && e !== null && s <= e ? input.slice(s, e) : undefined);
  }
  const namedGroups: Record<string, string> = {};
  for (const [name, idx] of compiled.names) {
    const val = groups[idx - 1];
    if (val !== undefined) namedGroups[name] = val;
  }
  return {
    matched: true,
    start,
    end,
    groups,
    namedGroups,
    stepCount: m.steps,
    trace: m.trace ?? undefined,
    limitExceeded: false,
  };
}
