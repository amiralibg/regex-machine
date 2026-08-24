/**
 * Machine → renderable graph. Pure data, no DOM, no layout — ELK positions
 * nodes later; this module decides WHAT is drawn: one node per state, one
 * edge per transition, with a visual kind that drives styling in the SVG
 * layer.
 */

import { matcherLabel } from 'engine';
import type { Dfa, Nfa, Span } from 'engine';

export type VizEdgeKind =
  | 'consume'
  | 'epsilon'
  | 'assert'
  | 'captureOpen'
  | 'captureClose'
  | 'loopEnter'
  | 'loopGuard'
  | 'backref'
  | 'gate';

export interface VizNode {
  id: string;
  accepting: boolean;
  isStart: boolean;
  /** set on gateEnter target states; indexes into nfa.gates */
  gateIndex?: number;
  /** chip text for gate nodes, e.g. `(?=` */
  gateLabel?: string;
  /** source spans (gate chips carry their lookaround group's span) */
  spans?: Span[];
}

export interface VizEdge {
  id: string;
  from: string;
  to: string;
  kind: VizEdgeKind;
  label: string;
  selfLoop: boolean;
  /** pattern spans that produced this edge — the highlighting contract */
  spans: Span[];
  /** NFA graphs only: which machine transition this edge renders */
  source?: { node: number; trans: number };
}

export interface MachineGraph {
  nodes: VizNode[];
  edges: VizEdge[];
}

const ANCHOR_LABELS: Record<string, string> = {
  lineStart: '^',
  lineEnd: '$',
  wordBoundary: '\\b',
  nonWordBoundary: '\\B',
};

function gateChip(kind: 'ahead' | 'behind', polarity: boolean): string {
  if (kind === 'ahead') return polarity ? '(?=' : '(?!';
  return polarity ? '(?<=' : '(?<!';
}

export function nfaToGraph(nfa: Nfa): MachineGraph {
  const nodes: VizNode[] = [];
  const edges: VizEdge[] = [];

  // gateEnter targets host the visual gate chip for their transition's gate
  const gateHosts = new Map<string, { gateIdx: number; chip: string; span: Span | null }>();
  for (let s = 0; s < nfa.states.length; s++) {
    for (const tr of nfa.states[s]!) {
      if (tr.kind === 'gateEnter') {
        const g = nfa.gates[tr.gateIdx];
        gateHosts.set(String(tr.target), {
          gateIdx: tr.gateIdx,
          chip: g ? gateChip(g.kind, g.polarity) : '(?)',
          span: tr.span,
        });
      }
    }
  }

  for (let s = 0; s < nfa.states.length; s++) {
    const host = gateHosts.get(String(s));
    nodes.push({
      id: String(s),
      accepting: s === nfa.accept,
      isStart: s === nfa.start,
      gateIndex: host?.gateIdx,
      gateLabel: host?.chip,
      spans: host && host.span !== null ? [host.span] : undefined,
    });
  }

  let ei = 0;
  for (let s = 0; s < nfa.states.length; s++) {
    let transitionIndex = 0;
    for (const tr of nfa.states[s]!) {
      let to: number;
      let kind: VizEdgeKind;
      let label = '';
      switch (tr.kind) {
        case 'consume':
          to = tr.target;
          kind = 'consume';
          label = matcherLabel(tr.matcher);
          break;
        case 'epsilon':
          to = tr.target;
          kind = 'epsilon';
          break;
        case 'assert':
          to = tr.target;
          kind = 'assert';
          label = ANCHOR_LABELS[tr.check] ?? tr.check;
          break;
        case 'captureOpen':
          to = tr.target;
          kind = 'captureOpen';
          label = `(${tr.group}`;
          break;
        case 'captureClose':
          to = tr.target;
          kind = 'captureClose';
          label = `${tr.group})`;
          break;
        case 'loopEnter':
          to = tr.target;
          kind = 'loopEnter';
          break;
        case 'loopGuard':
          to = tr.contTarget;
          kind = 'loopGuard';
          label = '⟲';
          break;
        case 'backref':
          to = tr.target;
          kind = 'backref';
          label = `\\${tr.group}`;
          break;
        case 'gateEnter':
          to = tr.target;
          kind = 'gate';
          break;
      }
      edges.push({
        id: `e${ei++}`,
        from: String(s),
        to: String(to),
        kind,
        label,
        selfLoop: s === to,
        spans: tr.span !== null ? [tr.span] : [],
        source: { node: s, trans: transitionIndex },
      });
      transitionIndex++;
    }
  }

  return { nodes, edges };
}

export function dfaToGraph(dfa: Dfa): MachineGraph {
  return {
    nodes: dfa.states.map((s) => ({
      id: String(s.id),
      accepting: s.accepting,
      isStart: s.id === 0,
    })),
    edges: dfa.edges.map((e, i) => ({
      id: `d${i}`,
      from: String(e.from),
      to: String(e.to),
      kind: e.sym.t === 'assert' ? ('assert' as const) : ('consume' as const),
      label: e.label,
      selfLoop: e.from === e.to,
      spans: e.spans,
    })),
  };
}
