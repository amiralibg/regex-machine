/**
 * Async ELK layout: positioned nodes + routed edge polylines for the SVG
 * layer. Self-loops are excluded here (routed manually in the renderer) —
 * layered handles them poorly.
 */

import ELK from 'elkjs/lib/elk.bundled.js';
import type { MachineGraph } from './machineGraph';

const elk = new ELK();

export const NODE_SIZE = 44;

export interface LaidOutNode {
  id: string;
  x: number;
  y: number;
}

export interface RoutedEdge {
  id: string;
  /** absolute points source → target, endpoints trimmed to the node rim */
  points: { x: number; y: number }[];
}

export interface LayoutResult {
  nodes: LaidOutNode[];
  edges: RoutedEdge[];
  width: number;
  height: number;
}

interface ElkPoint {
  x: number;
  y: number;
}

const center = (n: { x: number; y: number }): { x: number; y: number } => ({
  x: n.x + NODE_SIZE / 2,
  y: n.y + NODE_SIZE / 2,
});

/** pull an endpoint out to the node rim along the segment direction */
function trimToRim(p: ElkPoint, c: ElkPoint, rim: number): ElkPoint {
  const dx = c.x - p.x;
  const dy = c.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: c.x - (dx / len) * rim, y: c.y - (dy / len) * rim };
}

export async function layoutMachine(graph: MachineGraph): Promise<LayoutResult> {
  const routable = graph.edges.filter((e) => !e.selfLoop);

  const layout = await elk.layout(
    {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.spacing.nodeNodeBetweenLayers': '72',
        'elk.spacing.nodeNode': '44',
        // headroom for self-loop arcs + start stubs
        'elk.padding': '[top=72, left=56, bottom=32, right=32]',
      },
      children: graph.nodes.map((n) => ({
        id: n.id,
        width: NODE_SIZE,
        height: NODE_SIZE,
      })),
      edges: routable.map((e) => ({
        id: e.id,
        sources: [e.from],
        targets: [e.to],
      })),
    },
    {},
  );

  const posById = new Map<string, { x: number; y: number }>();
  let maxX = 0;
  let maxY = 0;
  for (const child of layout.children ?? []) {
    if (typeof child.id !== 'string' || typeof child.x !== 'number' || typeof child.y !== 'number') {
      continue;
    }
    posById.set(child.id, { x: child.x, y: child.y });
    maxX = Math.max(maxX, child.x + NODE_SIZE);
    maxY = Math.max(maxY, child.y + NODE_SIZE);
  }

  const nodeCenterById = (id: string): ElkPoint | null => {
    const n = posById.get(id);
    return n ? center(n) : null;
  };

  const edges: RoutedEdge[] = [];
  for (const e of routable) {
    const routed = (layout.edges ?? []).find((le) => le.id === e.id);
    const sec = routed?.sections?.[0];
    if (!sec || !sec.startPoint || !sec.endPoint) continue;
    const raw: ElkPoint[] = [sec.startPoint, ...(sec.bendPoints ?? []), sec.endPoint];
    if (raw.length < 2) continue;

    const fromC = nodeCenterById(e.from);
    const toC = nodeCenterById(e.to);
    const points = raw.map((p) => ({ x: p.x, y: p.y }));
    if (fromC) points[0] = trimToRim(points[1]!, fromC, 20);
    if (toC) points[points.length - 1] = trimToRim(points[points.length - 2]!, toC, 24);

    edges.push({ id: e.id, points });
    for (const p of points) {
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }

  return { nodes: [...posById].map(([id, p]) => ({ id, ...p })), edges, width: maxX + 32, height: maxY + 32 };
}
