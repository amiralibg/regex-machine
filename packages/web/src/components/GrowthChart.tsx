import { useMemo } from 'react';
import type { GrowthPoint } from '../lib/growth';

const W = 640;
const H = 220;
const PAD = { l: 56, r: 16, t: 14, b: 30 };

/**
 * Steps vs input length, log-scale y. An exponential blow-up is a straight
 * line here — the shareable artifact from the brief. Points past the step
 * limit render as a wall marker.
 */
export function GrowthChart({ points, inputDesc }: { points: GrowthPoint[]; inputDesc: string }) {
  const { xs, paths, yTicks, xTicks, limitAt } = useMemo(() => {
    const finite = points.filter((p) => p.steps !== null);
    const limitAt = points.find((p) => p.steps === null)?.n ?? null;

    const maxLog = 6; // log10(1e6)
    const minLog = 0;
    const nMax = Math.max(...points.map((p) => p.n), 8);

    const x = (n: number): number => PAD.l + ((n - 4) / (nMax - 4)) * (W - PAD.l - PAD.r);
    const y = (logSteps: number): number => H - PAD.b - ((logSteps - minLog) / (maxLog - minLog)) * (H - PAD.t - PAD.b);

    const yTicks: Array<{ v: number; y: number }> = [];
    for (let e = minLog; e <= maxLog; e++) yTicks.push({ v: 10 ** e, y: y(e) });

    const xTicks = points.map((p) => ({ n: p.n, x: x(p.n) }));

    const pts = finite.map((p) => ({ x: x(p.n), y: y(Math.log10(Math.max(1, p.steps!))) }));
    const path = pts.length > 1 ? `M ${pts.map((p) => `${p.x} ${p.y}`).join(' L ')}` : '';

    return {
      xs: pts,
      paths: path,
      yTicks,
      xTicks,
      limitAt,
    };
  }, [points]);

  return (
    <div className="flex flex-col gap-2">
      <svg width={W} height={H} className="block max-w-full" style={{ background: 'var(--color-panel)', border: '1px solid var(--color-hairline)', borderRadius: 8 }}>
        {/* gridlines + y labels */}
        {yTicks.map((t) => (
          <g key={t.v}>
            <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y} stroke="var(--color-hairline)" strokeWidth={1} />
            <text x={PAD.l - 6} y={t.y + 3} textAnchor="end" fontSize="9" fontFamily="var(--font-mono)" fill="var(--color-faint)">
              {t.v >= 1000 ? `1e${Math.round(Math.log10(t.v))}` : t.v}
            </text>
          </g>
        ))}
        {/* x labels */}
        {xTicks.map((t) => (
          <text key={t.n} x={t.x} y={H - PAD.b + 14} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--color-faint)">
            {t.n}
          </text>
        ))}
        <text x={(W + PAD.l) / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--color-faint)">
          input length ({inputDesc})
        </text>
        <text x={12} y={H / 2} textAnchor="middle" fontSize="9" fill="var(--color-faint)" transform={`rotate(-90 12 ${H / 2})`}>
          VM steps (log)
        </text>

        {/* the curve */}
        <path d={paths} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
        {xs.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.2} fill="var(--color-accent)" />
        ))}

        {/* the wall where measurement gave up */}
        {limitAt !== null && (() => {
          const nMax = Math.max(...points.map((p) => p.n), 8);
          const x = PAD.l + ((limitAt - 4) / (nMax - 4)) * (W - PAD.l - PAD.r);
          return (
            <g>
              <line x1={x} y1={PAD.t} x2={x} y2={H - PAD.b} stroke="var(--color-gate)" strokeDasharray="4 4" strokeWidth={1.2} />
              <text x={x + 5} y={PAD.t + 10} fontSize="9" fontFamily="var(--font-mono)" fill="var(--color-gate)">
                step limit
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
