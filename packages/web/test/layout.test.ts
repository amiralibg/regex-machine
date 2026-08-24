import { describe, expect, it } from 'vitest';
import { compileRegex } from 'engine';
import { nfaToGraph } from '../src/lib/machineGraph';
import { layoutMachine } from '../src/lib/layout';

describe('layoutMachine', () => {
  it('positions every node and routes every non-self-loop edge', async () => {
    const g = nfaToGraph(compileRegex('(a|b)*abb', '').nfa);
    const r = await layoutMachine(g);

    expect(r.nodes).toHaveLength(g.nodes.length);
    const ids = new Set(r.nodes.map((n) => n.id));
    expect(ids.size).toBe(g.nodes.length);
    for (const n of r.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }

    const expected = g.edges.filter((e) => !e.selfLoop);
    expect(r.edges.length).toBe(expected.length);
    for (const e of r.edges) {
      expect(e.points.length).toBeGreaterThanOrEqual(2);
      const first = e.points[0]!;
      const last = e.points[e.points.length - 1]!;
      // endpoints must sit on some node rim
      const near = (p: { x: number; y: number }) =>
        r.nodes.some((n) => Math.hypot(n.x + 22 - p.x, n.y + 22 - p.y) < 26);
      expect(near(first)).toBe(true);
      expect(near(last)).toBe(true);
    }
  });

  it('handles self-loops without dropping other edges', async () => {
    const g = nfaToGraph(compileRegex('a*', '').nfa);
    const r = await layoutMachine(g);
    const selfLoopCount = g.edges.filter((e) => e.selfLoop).length;
    expect(r.edges.length).toBe(g.edges.length - selfLoopCount);
  });
});
