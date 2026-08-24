/**
 * "Prove it": measure VM steps against growing input lengths so the
 * complexity class shows up as a curve. Exponential growth reads as a
 * straight line on the log-scale chart.
 */

import { exec } from 'engine';
import type { CompiledRegex } from 'engine';

export interface GrowthPoint {
  n: number;
  /** total VM steps; null = exceeded the step limit at this length */
  steps: number | null;
}

export interface GrowthResult {
  points: GrowthPoint[];
  /** input that will be shown on the chart caption */
  sampleInputAt8: string;
}

const STEP_LIMIT = 400_000;

export async function measureGrowth(
  compiled: CompiledRegex,
  makeInput: (n: number) => string,
  maxN = 36,
): Promise<GrowthResult> {
  const points: GrowthPoint[] = [];
  const ns: number[] = [];
  for (let n = 4; n <= maxN; n += 4) ns.push(n);

  for (const n of ns) {
    // yield to the event loop so the UI can paint the "measuring" state
    await new Promise((r) => setTimeout(r, 0));
    const r = exec(compiled, makeInput(n), 0, { stepLimit: STEP_LIMIT });
    if (r.limitExceeded) {
      points.push({ n, steps: null });
      break; // no point measuring beyond the wall
    }
    points.push({ n, steps: r.stepCount });
  }
  return { points, sampleInputAt8: makeInput(8) };
}

/** rough doubling estimate from the two last finite points (per 4 chars) */
export function growthFactor(points: GrowthPoint[]): number | null {
  const finite = points.filter((p) => p.steps !== null);
  if (finite.length < 2) return null;
  const a = finite[finite.length - 2]!;
  const b = finite[finite.length - 1]!;
  if ((a.steps ?? 0) === 0) return null;
  return (b.steps! / a.steps!) || null;
}
