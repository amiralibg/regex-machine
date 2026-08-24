/**
 * Playback derivation: replay a trace prefix and produce everything the UI
 * needs to render one moment — playhead position, glowing edges/nodes,
 * step counter, rewind flag. Pure and synchronous; the trace is the
 * contract, this module is its only consumer.
 */

import type { TraceEvent } from 'engine';
import type { MachineGraph } from './machineGraph';

export interface PlaybackState {
  cursor: number;
  total: number;
  /** input position after the last applied event */
  pos: number;
  /** forward steps + rewinds so far (the visible counter) */
  stepCount: number;
  status: 'idle' | 'running' | 'accepted' | 'failed';
  /** viz edge ids and `node:<id>` entries to glow */
  activeIds: Set<string> | null;
  last: TraceEvent | null;
  wasRewind: boolean;
}

/** map `${node}:${trans}` → viz edge id for an NFA machine graph */
export function edgeIdLookup(graph: MachineGraph): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of graph.edges) {
    if (e.source) m.set(`${e.source.node}:${e.source.trans}`, e.id);
  }
  return m;
}

export function playbackAt(
  events: readonly TraceEvent[],
  cursor: number,
  lookup?: Map<string, string>,
): PlaybackState {
  const total = events.length;
  const c = Math.max(0, Math.min(cursor, total));

  let pos = 0;
  let stepCount = 0;
  for (let i = 0; i < c; i++) {
    const ev = events[i]!;
    if (ev.t === 'step') {
      stepCount++;
      pos = ev.posAfter;
    } else if (ev.t === 'rewind') {
      stepCount++;
      pos = ev.pos;
    }
    // gate/capture/accept/fail don't move or count
  }

  const last = c > 0 ? events[c - 1]! : null;
  let status: PlaybackState['status'] = 'idle';
  if (c === 0) status = 'idle';
  else if (last!.t === 'accept') status = 'accepted';
  else if (last!.t === 'fail') status = 'failed';
  else status = 'running';

  const activeIds = new Set<string>();
  if (last !== null) {
    if (last.t === 'step') {
      const id = lookup?.get(`${last.node}:${last.trans}`);
      activeIds.add(id ?? `node:${last.node}`);
    } else if (last.t === 'rewind') {
      const id = lookup?.get(`${last.node}:${last.trans}`);
      if (id !== undefined) activeIds.add(id);
      activeIds.add(`node:${last.node}`);
    } else if (last.t === 'gateEnter') {
      // glow the gate chip in the main machine
      activeIds.add(`node:${last.gateId}`);
    }
  }

  return {
    cursor: c,
    total,
    pos,
    stepCount,
    status,
    activeIds: activeIds.size > 0 ? activeIds : null,
    last,
    wasRewind: last?.t === 'rewind',
  };
}
