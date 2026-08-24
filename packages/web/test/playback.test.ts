import { describe, expect, it } from 'vitest';
import { compileRegex, exec } from 'engine';
import { nfaToGraph } from '../src/lib/machineGraph';
import { edgeIdLookup, playbackAt } from '../src/lib/playback';

function setup(pattern: string, input: string) {
  const compiled = compileRegex(pattern, '');
  const r = exec(compiled, input, 0, { trace: true });
  const graph = nfaToGraph(compiled.nfa);
  return { r, graph, lookup: edgeIdLookup(graph), events: r.trace! };
}

describe('playbackAt', () => {
  it('walks positions forward on a straight match', () => {
    const { events, lookup } = setup('ab', 'ab');
    // step through every event; pos must end at accept
    let s = playbackAt(events, 0, lookup);
    expect(s.status).toBe('idle');
    expect(s.pos).toBe(0);
    for (let c = 1; c <= events.length; c++) {
      s = playbackAt(events, c, lookup);
      expect(s.pos).toBeLessThanOrEqual(2);
    }
    expect(s.status).toBe('accepted');
    expect(s.pos).toBe(2);
    expect(s.stepCount).toBeGreaterThan(0);
  });

  it('glows a real viz edge for each forward step', () => {
    const { events, graph, lookup } = setup('ab', 'ab');
    const edgeIds = new Set(graph.edges.map((e) => e.id));
    for (let c = 1; c <= events.length; c++) {
      const s = playbackAt(events, c, lookup);
      if (s.last?.t === 'step') {
        for (const id of s.activeIds ?? []) {
          // every glowing id is either an existing edge or a node chip
          const ok = edgeIds.has(id) || id.startsWith('node:');
          expect(ok).toBe(true);
        }
      }
    }
  });

  it('rewinds explicitly and restores the playhead position', () => {
    // branch 'a' succeeds then 'c' fails ⇒ backtrack into 'ab' branch
    const { events, lookup } = setup('(a|ab)c', 'abc');
    let sawRewind = false;
    let rewindPos = -1;
    let acceptedAfterRewind = false;
    for (let c = 1; c <= events.length; c++) {
      const s = playbackAt(events, c, lookup);
      if (s.wasRewind && !sawRewind) {
        sawRewind = true;
        rewindPos = s.pos;
      }
      if (sawRewind && s.status === 'accepted') {
        acceptedAfterRewind = true;
        expect(s.pos).toBe(3);
      }
    }
    expect(sawRewind).toBe(true);
    // the rewind event restores control to the choice point BEFORE 'a'
    // (pos 0); the machine then re-runs through the 'ab' branch and accepts
    expect(rewindPos).toBe(0);
    expect(acceptedAfterRewind).toBe(true);
  });

  it('counts steps monotonically as the cursor advances', () => {
    const { events, lookup } = setup('a*b', 'aab');
    let prev = 0;
    for (let c = 0; c <= events.length; c++) {
      const s = playbackAt(events, c, lookup);
      expect(s.stepCount).toBeGreaterThanOrEqual(prev);
      prev = s.stepCount;
    }
  });

  it('reports failure status when nothing matches', () => {
    const { events, lookup } = setup('x', 'abc');
    const s = playbackAt(events, events.length, lookup);
    expect(s.status).toBe('failed');
  });
});
