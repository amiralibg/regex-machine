/**
 * Source spans must survive AST → NFA → DFA. This is the contract for
 * bidirectional highlighting: hovering a transition highlights exactly the
 * pattern substring that produced it.
 */

import { describe, expect, it } from 'vitest';
import { buildDfa, compileRegex } from '../src/index';

function transSpans(pattern: string, flags = ''): Array<{ kind: string; label?: string; span: { start: number; end: number } | null }> {
  const c = compileRegex(pattern, flags);
  const out: Array<{ kind: string; label?: string; span: { start: number; end: number } | null }> = [];
  for (const outs of c.nfa.states) {
    for (const tr of outs) {
      out.push({
        kind: tr.kind,
        ...(tr.kind === 'consume' ? { label: tr.matcher.t } : {}),
        span: 'span' in tr ? tr.span : null,
      });
    }
  }
  return out;
}

describe('transition spans', () => {
  it('literal consume carries its own chars', () => {
    const spans = transSpans('ab');
    const consumes = spans.filter((s) => s.kind === 'consume');
    expect(consumes.map((c) => c.span)).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
    ]);
  });

  it('loop skeleton edges carry the quantifier span (child + operator)', () => {
    const spans = transSpans('ab*');
    // 'b*' occupies offsets 1..3
    const loopEdges = spans.filter((s) => s.kind === 'loopEnter' || s.kind === 'loopGuard' || (s.kind === 'epsilon' && s.span !== null));
    expect(loopEdges.length).toBeGreaterThan(0);
    for (const e of loopEdges) {
      expect(e.span).toEqual({ start: 1, end: 3 });
    }
  });

  it('capture open/close carry the whole group span incl parens', () => {
    const spans = transSpans('(ab)+');
    // min copy + star-tail copy ⇒ body compiled twice ⇒ two open/close pairs
    const cap = spans.filter((s) => s.kind === 'captureOpen' || s.kind === 'captureClose');
    expect(cap.length).toBe(4);
    for (const c of cap) expect(c.span).toEqual({ start: 0, end: 4 });
  });

  it('gateEnter carries the lookaround group span', () => {
    const spans = transSpans('(?<=x)y');
    const gates = spans.filter((s) => s.kind === 'gateEnter');
    expect(gates).toHaveLength(1);
    expect(gates[0]!.span).toEqual({ start: 0, end: 6 });
  });

  it('backref carries its escape span', () => {
    const spans = transSpans('(a)\\1');
    const backrefs = spans.filter((s) => s.kind === 'backref');
    expect(backrefs).toHaveLength(1);
    expect(backrefs[0]!.span).toEqual({ start: 3, end: 5 });
  });

  it('alternation priority edges carry the alternation span', () => {
    const spans = transSpans('a|b');
    const alts = spans.filter((s) => s.kind === 'epsilon' && s.span !== null);
    for (const e of alts) expect(e.span).toEqual({ start: 0, end: 3 });
  });

  it('structural glue epsilons have null spans', () => {
    const spans = transSpans('abc');
    const plainEps = spans.filter((s) => s.kind === 'epsilon' && s.span === null);
    expect(plainEps.length).toBeGreaterThanOrEqual(1);
  });
});

describe('dfa edge spans', () => {
  it('edges aggregate the spans of contributing NFA transitions', () => {
    const dfa = buildDfa(compileRegex('ab|ac', '').nfa);
    // the shared 'a' edge should reference offset 0..1 from both branches
    const aEdge = dfa.edges.find((e) => e.label === 'a' && e.from === 0);
    expect(aEdge).toBeDefined();
    expect(aEdge!.spans).toContainEqual({ start: 0, end: 1 });
    const bOrCEdges = dfa.edges.filter((e) => e.label === 'b' || e.label === 'c');
    expect(bOrCEdges.flatMap((e) => e.spans)).toEqual(
      expect.arrayContaining([
        { start: 1, end: 2 },
        { start: 4, end: 5 },
      ]),
    );
  });
});
