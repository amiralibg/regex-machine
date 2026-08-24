import { describe, expect, it } from 'vitest';
import { growthFactor } from '../src/lib/growth';
import type { GrowthPoint } from '../src/lib/growth';

describe('growthFactor', () => {
  it('estimates the per-step multiplier', () => {
    const pts: GrowthPoint[] = [
      { n: 4, steps: 100 },
      { n: 8, steps: 400 },
      { n: 12, steps: 1600 },
    ];
    expect(growthFactor(pts)).toBeCloseTo(4);
  });

  it('ignores trailing limit-cutoffs', () => {
    const pts: GrowthPoint[] = [
      { n: 4, steps: 100 },
      { n: 8, steps: 300 },
      { n: 12, steps: null },
    ];
    expect(growthFactor(pts)).toBeCloseTo(3);
  });

  it('returns null without enough data', () => {
    expect(growthFactor([{ n: 4, steps: 5 }])).toBeNull();
    expect(growthFactor([])).toBeNull();
  });
});
