import { describe, expect, it } from 'vitest';
import { buildDfa, compileRegex } from 'engine';
import { dfaToGraph, nfaToGraph } from '../src/lib/machineGraph';
import { coveredChars, spansCover } from '../src/lib/spans';

describe('viz edges carry source spans', () => {
  it('consume edge span points at its own pattern chars', () => {
    const g = nfaToGraph(compileRegex('ab', '').nfa);
    const consumes = g.edges.filter((e) => e.kind === 'consume');
    expect(consumes.map((e) => e.spans)).toEqual([
      [{ start: 0, end: 1 }],
      [{ start: 1, end: 2 }],
    ]);
  });

  it('quantifier skeleton edges share the quantifier span', () => {
    const g = nfaToGraph(compileRegex('a*', '').nfa);
    const loopEdges = g.edges.filter((e) => e.kind === 'loopEnter' || e.kind === 'loopGuard');
    for (const e of loopEdges) {
      expect(e.spans).toEqual([{ start: 0, end: 2 }]);
    }
  });

  it('gate chip nodes carry the lookaround group span', () => {
    const g = nfaToGraph(compileRegex('(?!x)y', '').nfa);
    const chip = g.nodes.find((n) => n.gateIndex !== undefined);
    expect(chip?.spans).toEqual([{ start: 0, end: 5 }]);
  });

  it('dfa edges aggregate merged NFA spans', () => {
    const g = dfaToGraph(buildDfa(compileRegex('ab|ac', '').nfa));
    const aEdge = g.edges.find((e) => e.label === 'a' && e.from === '0');
    expect(aEdge!.spans).toContainEqual({ start: 0, end: 1 });
    expect(aEdge!.spans).toContainEqual({ start: 3, end: 4 });
  });
});

describe('span coverage helpers', () => {
  it('coveredChars lights exactly the covered units', () => {
    expect(coveredChars(5, [{ start: 1, end: 3 }])).toEqual([false, true, true, false, false]);
  });

  it('clamps out-of-range spans', () => {
    expect(coveredChars(3, [{ start: -5, end: 99 }])).toEqual([true, true, true]);
  });

  it('spansCover is half-open', () => {
    const s = [{ start: 2, end: 4 }];
    expect(spansCover(s, 2)).toBe(true);
    expect(spansCover(s, 3)).toBe(true);
    expect(spansCover(s, 4)).toBe(false);
    expect(spansCover(s, 1)).toBe(false);
  });
});
