import { useEffect } from 'react';
import type { PlaybackState } from '../lib/playback';
import type { TraceEvent } from 'engine';

const SPEEDS = [
  { label: '0.5×', ms: 600 },
  { label: '1×', ms: 300 },
  { label: '2×', ms: 140 },
  { label: '4×', ms: 60 },
];

function describe(ev: TraceEvent): string {
  switch (ev.t) {
    case 'step':
      return `${ev.consumed ? 'consume' : 'ε'} @${ev.pos}${ev.posAfter !== ev.pos ? `→${ev.posAfter}` : ''}`;
    case 'rewind':
      return `backtrack → node ${ev.node} @${ev.pos}`;
    case 'capture':
      return `cap(${ev.group}) ${ev.phase === 'open' ? 'open' : 'close'} @${ev.pos}`;
    case 'gateEnter':
      return `gate ${ev.polarity ? '' : 'negative '}${ev.kind} @${ev.pos}`;
    case 'gateExit':
      return `gate verdict: ${ev.verdict ? 'pass' : 'fail'}`;
    case 'accept':
      return `ACCEPT @${ev.pos}`;
    case 'fail':
      return 'FAIL';
  }
}

export function PlaybackControls({
  state,
  playing,
  speedIdx,
  onCursor,
  onPlayPause,
  onSpeed,
}: {
  state: PlaybackState;
  playing: boolean;
  speedIdx: number;
  onCursor: (c: number) => void;
  onPlayPause: (playing: boolean) => void;
  onSpeed: (idx: number) => void;
}) {
  const atEnd = state.cursor >= state.total;

  useEffect(() => {
    if (!playing) return;
    if (atEnd) {
      onPlayPause(false);
      return;
    }
    const t = setInterval(() => {
      onCursor(state.cursor + 1);
    }, SPEEDS[speedIdx]!.ms);
    return () => clearInterval(t);
  }, [playing, speedIdx, state.cursor, state.total, atEnd, onCursor, onPlayPause]);

  const btn = 'rounded px-2.5 py-1 font-mono text-xs transition-colors hover:brightness-125';
  const btnStyle = { border: '1px solid var(--color-hairline)', color: 'var(--color-dim)', background: 'var(--color-raise)' };

  const recent = state.last ? [state.last] : [];

  return (
    <div className="flex flex-col gap-2 rounded-lg p-3" style={{ border: '1px solid var(--color-hairline)', background: 'var(--color-panel)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} style={btnStyle} onClick={() => onCursor(0)} title="reset">
          ⏮
        </button>
        <button className={btn} style={btnStyle} onClick={() => onCursor(state.cursor - 1)} disabled={state.cursor === 0} title="step back">
          ◀
        </button>
        <button
          className={btn}
          style={{ ...btnStyle, color: playing ? 'var(--color-accent)' : 'var(--color-ink)' }}
          onClick={() => onPlayPause(!playing)}
          disabled={atEnd && !playing}
          title={playing ? 'pause' : 'play'}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <button className={btn} style={btnStyle} onClick={() => onCursor(state.cursor + 1)} disabled={atEnd} title="step forward">
          ▶|
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(state.total, 1)}
          value={state.cursor}
          onChange={(e) => {
            onPlayPause(false);
            onCursor(Number(e.target.value));
          }}
          className="mx-2 h-1 flex-1 accent-[var(--color-accent)]"
          style={{ accentColor: 'var(--color-accent)', minWidth: 120 }}
        />

        <div className="flex overflow-hidden rounded" style={{ border: '1px solid var(--color-hairline)' }}>
          {SPEEDS.map((s, i) => (
            <button
              key={s.label}
              onClick={() => onSpeed(i)}
              className="px-2 py-1 font-mono text-[10px]"
              style={{
                background: i === speedIdx ? 'var(--color-raise)' : 'transparent',
                color: i === speedIdx ? 'var(--color-accent)' : 'var(--color-faint)',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* running step counter */}
        <span className="ml-auto whitespace-nowrap font-mono text-xs tabular-nums" style={{ color: 'var(--color-dim)' }}>
          <span style={{ color: 'var(--color-accent)' }}>{state.stepCount}</span> steps
          <span style={{ color: 'var(--color-faint)' }}> · {state.cursor}/{state.total}</span>
        </span>

        {state.status === 'accepted' && (
          <span className="font-mono text-xs" style={{ color: 'var(--color-accent)' }}>✓ accepted</span>
        )}
        {state.status === 'failed' && (
          <span className="font-mono text-xs" style={{ color: 'var(--color-gate)' }}>✗ failed</span>
        )}
      </div>

      {/* last-event readout */}
      <div className="flex min-h-5 items-center font-mono text-[11px]" style={{ color: state.wasRewind ? 'var(--color-gate)' : 'var(--color-dim)' }}>
        {recent.map((ev) =>
          state.wasRewind ? (
            <span key={ev.i}>⟲ backtracking — {describe(ev)}</span>
          ) : (
            <span key={ev.i}>{describe(ev)}</span>
          ),
        )}
        {state.status === 'idle' && <span style={{ color: 'var(--color-faint)' }}>press ▶ to watch the machine run</span>}
      </div>
    </div>
  );
}
