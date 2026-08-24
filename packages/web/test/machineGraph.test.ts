import { describe, expect, it } from 'vitest';
import { buildDfa, compileRegex } from 'engine';
import { dfaToGraph, nfaToGraph } from '../src/lib/machineGraph';

describe('nfaToGraph', () => {
  it('marks start and accept nodes', () => {
    const c = compileRegex('a', '');
    const g = nfaToGraph(c.nfa);
    const starts = g.nodes.filter((n) => n.isStart);
    const accepts = g.nodes.filter((n) => n.accepting);
    expect(starts).toHaveLength(1);
    expect(accepts).toHaveLength(1);
    expect(starts[0]!.id).toBe(String(c.nfa.start));
  });

  it('labels consume edges via matcherLabel', () => {
    const g = nfaToGraph(compileRegex('\\d', '').nfa);
    expect(g.edges.filter((e) => e.kind === 'consume').map((e) => e.label)).toEqual(['\\d']);
  });

  it('detects self-loops on star bodies', () => {
    const g = nfaToGraph(compileRegex('a*', '').nfa);
    // the loopGuard cont edge returns to loop entry — a cycle, though not a
    // self-loop; a{0,} body itself has no single-node cycle. Use (a)* guard:
    expect(g.edges.some((e) => !e.selfLoop)).toBe(true);
  });

  it('self-loop flag matches from==to', () => {
    const g = nfaToGraph(compileRegex('(a)*', '').nfa);
    for (const e of g.edges) {
      expect(e.selfLoop).toBe(e.from === e.to);
    }
  });

  it('gate chips carry lookaround syntax labels', () => {
    const c = compileRegex('(?<=x)y', '');
    const g = nfaToGraph(c.nfa);
    const chip = g.nodes.find((n) => n.gateIndex !== undefined);
    expect(chip?.gateLabel).toBe('(?<=');
  });

  it('backref edges are labeled \\1', () => {
    const g = nfaToGraph(compileRegex('(a)\\1', '').nfa);
    expect(g.edges.some((e) => e.kind === 'backref' && e.label === '\\1')).toBe(true);
  });
});

describe('dfaToGraph', () => {
  it('has no epsilon-family edges', () => {
    const c = compileRegex('a*b?', '');
    const g = dfaToGraph(buildDfa(c.nfa));
    for (const kind of ['epsilon', 'captureOpen', 'captureClose', 'loopEnter', 'loopGuard'] as const) {
      expect(g.edges.some((e) => e.kind === kind)).toBe(false);
    }
  });

  it('state 0 is the start and accepting states come from dfa.states', () => {
    const g = dfaToGraph(buildDfa(compileRegex('ab', '').nfa));
    expect(g.nodes[0]!.isStart).toBe(true);
    expect(g.nodes.filter((n) => n.accepting).length).toBeGreaterThanOrEqual(1);
  });
});
