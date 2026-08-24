import { useMemo, useState } from 'react';
import type { Span } from 'engine';
import type { MachineGraph } from '../lib/machineGraph';
import { spansCover } from '../lib/spans';
import { GraphView } from './GraphView';

/**
 * One interactive machine rendering with its own hover scope (edge ids are
 * per-graph, so the gate inset must not share state with the main view).
 *
 * Bidirectional highlighting lives here:
 * - hovering an edge/chip reports ITS spans up to the pattern strip
 * - the strip's hovered char lights every edge whose spans cover it
 */
export function HighlightedGraph({
  viz,
  title,
  hoverChar,
  onGateClick,
  onSpans,
}: {
  viz: MachineGraph;
  title?: string;
  hoverChar: number | null;
  onGateClick?: (gateIndex: number) => void;
  onSpans?: (spans: Span[] | null) => void;
}) {
  const [selfHover, setSelfHover] = useState<{ kind: 'edge' | 'node'; id: string } | null>(null);

  const glow = useMemo(() => {
    const s = new Set<string>();
    if (hoverChar !== null) {
      for (const e of viz.edges) {
        if (spansCover(e.spans, hoverChar)) s.add(e.id);
      }
    }
    if (selfHover !== null) {
      s.add(selfHover.kind === 'node' ? `node:${selfHover.id}` : selfHover.id);
    }
    return s.size > 0 ? s : null;
  }, [viz, hoverChar, selfHover]);

  const handleHover = (h: { kind: 'edge' | 'node'; id: string } | null): void => {
    setSelfHover(h);
    if (!onSpans) return;
    if (h === null) {
      onSpans(null);
      return;
    }
    if (h.kind === 'edge') {
      onSpans(viz.edges.find((e) => e.id === h.id)?.spans ?? []);
    } else {
      onSpans(viz.nodes.find((n) => n.id === h.id)?.spans ?? []);
    }
  };

  return (
    <GraphView
      graph={viz}
      title={title}
      onGateClick={onGateClick}
      onHover={handleHover}
      activeEdgeIds={glow}
    />
  );
}
