/**
 * The trace format — the contract for everything downstream (playback,
 * ReDoS charts). Flat, ordered, serializable. Gate sub-runs splice their
 * events inline between gateEnter / gateExit.
 */

export type NodeId = number;
export type TransitionId = number;

export interface CaptureUndo {
  slot: number; // 2*group for open, 2*group+1 for close
  prev: number | null;
}

export type TraceEvent =
  | {
      t: 'step';
      i: number;
      node: NodeId; // state the step left
      trans: TransitionId;
      pos: number; // position before the step
      consumed: boolean;
    }
  | {
      t: 'rewind';
      i: number;
      node: NodeId; // choice point being restored
      pos: number; // position restored to
    }
  | {
      t: 'capture';
      i: number;
      group: number;
      phase: 'open' | 'close';
      pos: number;
      prev: number | null;
    }
  | {
      t: 'gateEnter';
      i: number;
      gateId: NodeId; // main-NFA node hosting the gate
      kind: 'ahead' | 'behind';
      polarity: boolean;
      pos: number;
    }
  | { t: 'gateExit'; i: number; gateId: NodeId; verdict: boolean }
  | { t: 'accept'; i: number; pos: number }
  | { t: 'fail'; i: number };

export interface MatchResult {
  matched: boolean;
  start: number;
  end: number;
  /** indexed capture groups; undefined when the group did not participate */
  groups: (string | undefined)[];
  namedGroups: Record<string, string>;
  /** present only when tracing is enabled */
  trace?: TraceEvent[];
  /** forward steps + rewind pops; the ReDoS metric */
  stepCount: number;
}
