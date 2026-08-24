import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { MachineGraph, VizEdgeKind } from '../lib/machineGraph';
import { layoutMachine } from '../lib/layout';
import type { LayoutResult } from '../lib/layout';

interface EdgeStyle {
  stroke: string;
  dash?: string;
  width: number;
}

const EDGE_STYLES: Record<VizEdgeKind, EdgeStyle> = {
  consume: { stroke: 'var(--color-consume)', width: 1.6 },
  epsilon: { stroke: 'var(--color-faint)', dash: '5 5', width: 1.2 },
  assert: { stroke: 'var(--color-accent)', dash: '2 4', width: 1.4 },
  captureOpen: { stroke: 'var(--color-capture)', dash: '7 4', width: 1.3 },
  captureClose: { stroke: 'var(--color-capture)', dash: '7 4', width: 1.3 },
  loopEnter: { stroke: 'var(--color-loop)', dash: '3 3', width: 1.2 },
  loopGuard: { stroke: 'var(--color-loop)', dash: '3 3', width: 1.4 },
  backref: { stroke: 'var(--color-backref)', width: 1.6 },
  gate: { stroke: 'var(--color-gate)', width: 1.8 },
};

const RIM = 20;
const ARROW = 9;

function pathThrough(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) d += ` L ${points[i]!.x} ${points[i]!.y}`;
  return d;
}

/** rounded-corner orthogonal-ish path */
function roundedPath(points: { x: number; y: number }[], r = 8): string {
  if (points.length < 2) return '';
  if (points.length === 2) return pathThrough(points);
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const next = points[i + 1]!;
    const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const outLen = Math.hypot(next.x - cur.x, next.y - cur.y);
    const rr = Math.min(r, inLen / 2, outLen / 2);
    const inX = cur.x - ((cur.x - prev.x) / (inLen || 1)) * rr;
    const inY = cur.y - ((cur.y - prev.y) / (inLen || 1)) * rr;
    const outX = cur.x + ((next.x - cur.x) / (outLen || 1)) * rr;
    const outY = cur.y + ((next.y - cur.y) / (outLen || 1)) * rr;
    d += ` L ${inX} ${inY} Q ${cur.x} ${cur.y} ${outX} ${outY}`;
  }
  const last = points[points.length - 1]!;
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function arrowAt(points: { x: number; y: number }[]): { angle: number; base: { x: number; y: number } } | null {
  if (points.length < 2) return null;
  const a = points[points.length - 2]!;
  const b = points[points.length - 1]!;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return null;
  const ux = dx / len;
  const uy = dy / len;
  const back = ARROW * 0.72;
  return {
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    base: { x: b.x - ux * back, y: b.y - uy * back },
  };
}

function labelAnchor(points: { x: number; y: number }[]): { x: number; y: number } | null {
  let best = 0;
  let bestMid: { x: number; y: number } | null = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > best) {
      best = len;
      bestMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }
  return bestMid;
}

export function GraphView({
  graph,
  title,
  onGateClick,
  onHover,
  activeEdgeIds,
}: {
  graph: MachineGraph;
  title?: string;
  onGateClick?: (gateIndex: number) => void;
  /** reports the edge/node under the cursor (null = left) */
  onHover?: (hover: { kind: 'edge' | 'node'; id: string } | null) => void;
  /** edges that should glow (from either direction of highlighting) */
  activeEdgeIds?: Set<string> | null;
}) {
  // layout result stored TOGETHER WITH the graph it was computed from:
  // on keystrokes React re-renders with a new graph before effects run,
  // and rendering stale positions against a new machine crashes
  const [laid, setLaid] = useState<{ graph: MachineGraph; data: LayoutResult } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLaid(null);
    setFailed(null);
    layoutMachine(graph)
      .then((r) => {
        if (!cancelled) setLaid({ graph, data: r });
      })
      .catch((e: unknown) => {
        // an elk failure must freeze on "laying out…" forever, not blank the app
        if (!cancelled) setFailed(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [graph]);

  if (failed !== null) {
    return (
      <div className="rounded-lg px-4 py-6 text-center font-mono text-xs" style={{ border: '1px solid var(--color-hairline)', background: 'var(--color-panel)', color: 'var(--color-gate)' }}>
        graph layout failed: {failed}
      </div>
    );
  }

  const layout = laid !== null && laid.graph === graph ? laid.data : null;
  if (!layout) {
    return (
      <div className="flex h-40 items-center justify-center text-sm" style={{ color: 'var(--color-faint)' }}>
        laying out…
      </div>
    );
  }

  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));
  const routedById = new Map(layout.edges.map((e) => [e.id, e]));
  const selfLoops = graph.edges.filter((e) => e.selfLoop);
  const anyActive = (activeEdgeIds?.size ?? 0) > 0;
  const isGlowing = (id: string): boolean => activeEdgeIds?.has(id) === true;

  return (
    <div
      className="overflow-auto rounded-lg"
      style={{ border: '1px solid var(--color-hairline)', background: 'var(--color-panel)' }}
    >
      {title && (
        <div
          className="px-3 py-2 font-mono text-xs tracking-wide"
          style={{ color: 'var(--color-dim)', borderBottom: '1px solid var(--color-hairline)' }}
        >
          {title}
        </div>
      )}
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        // scale to fit until ~1000px wide; larger machines scroll instead of
        // shrinking into illegibility
        width="100%"
        style={{ maxWidth: layout.width, minWidth: Math.min(layout.width, 1000), display: 'block' }}
      >
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
        {/* edges */}
        {graph.edges.map((e) => {
          const routed = routedById.get(e.id);
          if (!routed) return null; // self-loop, drawn separately
          const style = EDGE_STYLES[e.kind];
          const arrow = arrowAt(routed.points);
          const mid = labelAnchor(routed.points);
          const glow = isGlowing(e.id);
          return (
            <g
              key={e.id}
              opacity={!anyActive || glow ? 1 : 0.28}
              onMouseEnter={() => onHover?.({ kind: 'edge', id: e.id })}
              onMouseLeave={() => onHover?.(null)}
            >
              {/* fat invisible hit area */}
              <path d={roundedPath(routed.points)} fill="none" stroke="transparent" strokeWidth={12} />
              <path
                d={roundedPath(routed.points)}
                fill="none"
                stroke={glow ? 'var(--color-accent)' : style.stroke}
                strokeWidth={style.width + (glow ? 0.8 : 0)}
                strokeDasharray={style.dash}
                className="transition-all duration-75"
              />
              {arrow && (
                <polygon
                  points={`0,-3.2 ${ARROW},0 0,3.2`}
                  transform={`translate(${arrow.base.x} ${arrow.base.y}) rotate(${arrow.angle})`}
                  fill={glow ? 'var(--color-accent)' : style.stroke}
                />
              )}
              {e.label && mid && (
                <text
                  x={mid.x}
                  y={mid.y - 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                  fill={style.stroke}
                  stroke="var(--color-panel)"
                  strokeWidth="3"
                  paintOrder="stroke"
                  className="pointer-events-none"
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}

        {/* self loops */}
        {selfLoops.map((e) => {
          const n = nodeById.get(e.from);
          if (!n) return null;
          const cx = n.x + 22;
          const cy = n.y + 22;
          const style = EDGE_STYLES[e.kind];
          const glow = isGlowing(e.id);
          const lift = 26;
          const p1 = { x: cx - 10, y: cy - RIM + 2 };
          const p2 = { x: cx + 10, y: cy - RIM + 2 };
          const apex = { x: cx, y: cy - RIM - lift };
          const d = `M ${p1.x} ${p1.y} C ${p1.x - 14} ${apex.y}, ${p2.x + 14} ${apex.y}, ${p2.x} ${p2.y}`;
          const arrow = { x: p2.x, y: p2.y - 1 };
          return (
            <g
              key={e.id}
              opacity={!anyActive || glow ? 1 : 0.28}
              onMouseEnter={() => onHover?.({ kind: 'edge', id: e.id })}
              onMouseLeave={() => onHover?.(null)}
            >
              <path d={d} fill="none" stroke="transparent" strokeWidth={12} />
              <path
                d={d}
                fill="none"
                stroke={glow ? 'var(--color-accent)' : style.stroke}
                strokeWidth={style.width + (glow ? 0.8 : 0)}
                strokeDasharray={style.dash}
              />
              <polygon
                points={`-3.2,-${ARROW} 0,0 3.2,-${ARROW}`}
                transform={`translate(${arrow.x} ${arrow.y})`}
                fill={glow ? 'var(--color-accent)' : style.stroke}
              />
              {e.label && (
                <text
                  x={cx}
                  y={cy - RIM - lift - 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                  fill={style.stroke}
                  stroke="var(--color-panel)"
                  strokeWidth="3"
                  paintOrder="stroke"
                  className="pointer-events-none"
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}

        {/* start stub */}
        {layout.nodes.map((n) => {
          const g = graph.nodes.find((gn) => gn.id === n.id);
          if (!g?.isStart) return null;
          const sx = n.x - 34;
          const sy = n.y + 22;
          return (
            <g key={`start-${n.id}`}>
              <line x1={sx} y1={sy} x2={n.x - RIM + 2} y2={sy} stroke="var(--color-start)" strokeWidth="1.8" />
              <polygon
                points="-8,-3.6 0,0 -8,3.6"
                transform={`translate(${n.x - RIM + 2} ${sy}) rotate(0)`}
                fill="var(--color-start)"
              />
            </g>
          );
        })}

        {/* nodes */}
        {layout.nodes.map((n) => {
          const g = graph.nodes.find((gn) => gn.id === n.id);
          if (g === undefined) return null; // cannot happen post-identity-check; belt and suspenders
          const cx = n.x + 22;
          const cy = n.y + 22;

          if (g.gateLabel !== undefined) {
            const chipGlow = isGlowing(`node:${n.id}`);
            return (
              <g
                key={n.id}
                className={onGateClick ? 'cursor-pointer' : undefined}
                style={{ opacity: !anyActive || chipGlow ? 1 : 0.35 }}
                onClick={() => g.gateIndex !== undefined && onGateClick?.(g.gateIndex)}
                onMouseEnter={() => onHover?.({ kind: 'node', id: n.id })}
                onMouseLeave={() => onHover?.(null)}
              >
                <rect
                  x={n.x + 2}
                  y={n.y + 6}
                  width={40}
                  height={32}
                  rx={7}
                  fill="var(--color-canvas)"
                  stroke={chipGlow ? 'var(--color-accent)' : 'var(--color-gate)'}
                  strokeWidth={chipGlow ? 2.2 : 1.6}
                />
                <text
                  x={cx}
                  y={cy + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                  fill={chipGlow ? 'var(--color-accent)' : 'var(--color-gate)'}
                >
                  {g.gateLabel}
                </text>
                {onGateClick && (
                  <text x={cx} y={cy + 22} textAnchor="middle" fontSize="8" fill="var(--color-faint)">
                    inspect ▾
                  </text>
                )}
              </g>
            );
          }

          return (
            <g key={n.id}>
              {(() => {
                const glowing = activeEdgeIds?.has(`node:${n.id}`) === true;
                return (
                  <>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={16}
                      fill={glowing ? 'rgba(242,178,62,0.12)' : 'var(--color-canvas)'}
                      stroke={glowing ? 'var(--color-accent)' : 'var(--color-faint)'}
                      strokeWidth={glowing ? 2.2 : 1.4}
                    />
                    {g.accepting && (
                      <circle cx={cx} cy={cy} r={12} fill="none" stroke="var(--color-accent)" strokeWidth={1.6} />
                    )}
                    <text
                      x={cx}
                      y={cy + 3.5}
                      textAnchor="middle"
                      fontSize="10"
                      fontFamily="var(--font-mono)"
                      fill={glowing || g.accepting ? 'var(--color-accent)' : 'var(--color-dim)'}
                    >
                      {n.id}
                    </text>
                  </>
                );
              })()}
            </g>
          );
        })}
        </motion.g>
      </svg>
    </div>
  );
}
