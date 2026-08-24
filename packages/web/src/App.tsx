import { useEffect, useMemo, useState } from 'react';
import { buildDfa, compileRegex, exec, isRegularNfa } from 'engine';
import type { RegexSyntaxError, Span, UnsupportedSyntaxError } from 'engine';
import { dfaToGraph, nfaToGraph } from './lib/machineGraph';
import { edgeIdLookup, playbackAt } from './lib/playback';
import { HighlightedGraph } from './components/HighlightedGraph';
import { PatternStrip } from './components/PatternStrip';
import { InputStrip } from './components/InputStrip';
import { PlaybackControls } from './components/PlaybackControls';

const EXAMPLES: Array<{ label: string; pattern: string; flags?: string }> = [
  { label: 'alternation order', pattern: '(a|ab)+c' },
  { label: 'empty-loop quirk', pattern: '(a*)*b' },
  { label: 'nested quantifier', pattern: '((a{0,2}){0,2}){0,2}', flags: '' },
  { label: 'lookbehind', pattern: '(?<=@)\\w+' },
  { label: 'backref', pattern: '(\\w+) \\1' },
  { label: 'lazy vs greedy', pattern: '<.+?>', flags: '' },
];

function errMessage(e: unknown): string {
  const name = (e as InstanceType<typeof RegexSyntaxError> | InstanceType<typeof UnsupportedSyntaxError>)?.name;
  return `${name ?? 'Error'}: ${(e as Error)?.message ?? String(e)}`;
}

export function App() {
  const [pattern, setPattern] = useState('(a|ab)+c');
  const [flags, setFlags] = useState('');
  const [input, setInput] = useState('ababc');
  const [view, setView] = useState<'nfa' | 'dfa'>('nfa');
  const [openGate, setOpenGate] = useState<number | null>(null);
  const [hoverChar, setHoverChar] = useState<number | null>(null);
  const [stripHighlight, setStripHighlight] = useState<Span[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);

  const compiled = useMemo(() => {
    try {
      return { ok: true as const, value: compileRegex(pattern, flags) };
    } catch (e) {
      return { ok: false as const, error: errMessage(e) };
    }
  }, [pattern, flags]);

  const regular = compiled.ok ? isRegularNfa(compiled.value.nfa) : true;

  const nfaGraph = useMemo(() => (compiled.ok ? nfaToGraph(compiled.value.nfa) : null), [compiled]);
  const dfaGraph = useMemo(
    () => (compiled.ok && regular ? dfaToGraph(buildDfa(compiled.value.nfa)) : null),
    [compiled, regular],
  );

  const preview = useMemo(() => {
    if (!compiled.ok || input === '') return null;
    const r = exec(compiled.value, input, 0);
    return r;
  }, [compiled, input]);

  // full trace for playback — only worth it for reasonable trace sizes
  const traced = useMemo(() => {
    if (!compiled.ok || input === '') return null;
    const r = exec(compiled.value, input, 0, { trace: true });
    if (r.limitExceeded || !r.trace || r.trace.length > 200_000) return { tooBig: true as const };
    return { tooBig: false as const, result: r };
  }, [compiled, input]);

  const nfaViz = useMemo(() => (compiled.ok ? nfaToGraph(compiled.value.nfa) : null), [compiled]);
  const lookup = useMemo(() => (nfaViz ? edgeIdLookup(nfaViz) : null), [nfaViz]);
  const pb = useMemo(
    () => (traced && !traced.tooBig && nfaViz ? playbackAt(traced.result.trace!, cursor, lookup ?? undefined) : null),
    [traced, cursor, lookup, nfaViz],
  );

  // a stale gate/cursor means nothing once the machine or input changes
  useEffect(() => {
    setOpenGate(null);
    setHoverChar(null);
    setStripHighlight(null);
    setCursor(0);
    setPlaying(false);
  }, [compiled, input]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <header className="flex items-baseline justify-between">
        <h1 className="font-mono text-lg font-semibold tracking-tight">regex-machine</h1>
        <span className="text-xs" style={{ color: 'var(--color-faint)' }}>
          phase 2 · graph rendering
        </span>
      </header>

      {/* inputs */}
      <div className="flex flex-col gap-3 rounded-lg p-4" style={{ border: '1px solid var(--color-hairline)', background: 'var(--color-panel)' }}>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm" style={{ color: 'var(--color-dim)' }}>/</span>
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            spellCheck={false}
            className="w-full flex-1 bg-transparent font-mono text-sm outline-none"
            style={{ color: 'var(--color-ink)' }}
          />
          <span className="font-mono text-sm" style={{ color: 'var(--color-dim)' }}>/</span>
          <input
            value={flags}
            onChange={(e) => setFlags(e.target.value.replace(/[^igms]/g, '').slice(0, 4))}
            spellCheck={false}
            placeholder="flags"
            className="w-16 bg-transparent font-mono text-sm outline-none"
            style={{ color: 'var(--color-accent)' }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-faint)' }}>
            test
          </span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            className="w-full flex-1 bg-transparent font-mono text-sm outline-none"
            style={{ color: 'var(--color-ink)' }}
          />
          {preview && (
            <span className="whitespace-nowrap font-mono text-xs" style={{ color: preview.matched ? 'var(--color-accent)' : 'var(--color-faint)' }}>
              {preview.matched
                ? `✓ ${JSON.stringify(input.slice(preview.start, preview.end))} @ ${preview.start} · ${preview.stepCount} steps`
                : `no match · ${preview.stepCount} steps`}
            </span>
          )}
        </div>
        {!compiled.ok && (
          <div className="rounded px-3 py-2 font-mono text-xs" style={{ background: 'rgba(239,127,127,0.08)', color: '#ef7f7f', border: '1px solid rgba(239,127,127,0.25)' }}>
            {compiled.error}
          </div>
        )}
        {compiled.ok && (
          <PatternStrip pattern={pattern} highlight={stripHighlight} onHoverChar={setHoverChar} />
        )}
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => {
                setPattern(ex.pattern);
                setFlags(ex.flags ?? '');
                setOpenGate(null);
              }}
              className="rounded-full px-2.5 py-1 text-xs transition-colors hover:brightness-125"
              style={{
                border: '1px solid var(--color-hairline)',
                color: 'var(--color-dim)',
                background: ex.pattern === pattern ? 'var(--color-raise)' : 'transparent',
                ...(ex.pattern === pattern ? { borderColor: 'var(--color-accent)' } : {}),
              }}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* playback (NFA view only) */}
      {compiled.ok && view === 'nfa' && input !== '' && nfaViz && traced && pb && (
        <div className="flex flex-col gap-3">
          <div
            className="rounded-lg px-4 py-2"
            style={{ border: '1px solid var(--color-hairline)', background: 'var(--color-panel)' }}
          >
            <div className="mb-1 text-[10px] uppercase tracking-widest" style={{ color: 'var(--color-faint)' }}>
              input · playhead
            </div>
            <InputStrip
              input={input}
              pos={pb.pos}
              matchRange={traced && !traced.tooBig && traced.result.matched ? [traced.result.start, traced.result.end] : null}
              wasRewind={pb.wasRewind}
            />
          </div>
          {traced.tooBig ? (
            <div className="rounded-lg px-3 py-2 text-xs" style={{ border: '1px solid var(--color-hairline)', color: 'var(--color-dim)' }}>
              trace too large to play back — simplify the pattern or shorten the input
            </div>
          ) : (
            <PlaybackControls
              state={pb}
              playing={playing}
              speedIdx={speedIdx}
              onCursor={setCursor}
              onPlayPause={setPlaying}
              onSpeed={setSpeedIdx}
            />
          )}
        </div>
      )}

      {/* view toggle */}
      <div className="flex items-center gap-3">
        <div className="flex overflow-hidden rounded-md" style={{ border: '1px solid var(--color-hairline)' }}>
          {(['nfa', 'dfa'] as const).map((m) => {
            const disabled = m === 'dfa' && !regular;
            const active = view === m;
            return (
              <button
                key={m}
                disabled={disabled}
                onClick={() => setView(m)}
                className="px-4 py-1.5 font-mono text-xs uppercase tracking-wider transition-opacity disabled:cursor-not-allowed"
                style={{
                  background: active ? 'var(--color-raise)' : 'transparent',
                  color: disabled ? 'var(--color-faint)' : active ? 'var(--color-ink)' : 'var(--color-dim)',
                  opacity: disabled ? 0.55 : 1,
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
        {!regular && (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-dim)' }}>
            This pattern uses backreferences or lookaround — features of a{' '}
            <em>backtracking</em> matcher, not a regular language. No DFA can express them; the NFA
            shows them as annotated special edges and gate chips instead.
          </p>
        )}
      </div>

      {/* graph */}
      {compiled.ok && nfaGraph && (
        <>
          {view === 'nfa' ? (
            <HighlightedGraph
              viz={nfaGraph}
              title={`NFA · /${pattern}/${flags}`}
              hoverChar={hoverChar}
              onGateClick={setOpenGate}
              onSpans={setStripHighlight}
              pinnedIds={pb?.activeIds ?? null}
            />
          ) : dfaGraph ? (
            <HighlightedGraph
              viz={dfaGraph}
              title={`DFA · /${pattern}/${flags} · ${dfaGraph.nodes.length} states`}
              hoverChar={hoverChar}
              onSpans={setStripHighlight}
            />
          ) : null}
        </>
      )}

      {/* gate inset */}
      {compiled.ok && openGate !== null && compiled.value.nfa.gates[openGate] && view === 'nfa' && (
        <HighlightedGraph
          viz={nfaToGraph(compiled.value.nfa.gates[openGate]!.nfa)}
          title={`sub-machine · gate #${openGate}`}
          hoverChar={hoverChar}
          onSpans={setStripHighlight}
        />
      )}

      <footer className="flex flex-col gap-2 pb-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--color-faint)' }}>
          <LegendSwatch kind="consume" label="consume" />
          <LegendSwatch kind="epsilon" label="ε (epsilon)" />
          <LegendSwatch kind="assert" label="assert ^ $ \b" />
          <LegendSwatch kind="captureOpen" label="capture ( )" />
          <LegendSwatch kind="loopGuard" label="loop ⟲" />
          <LegendSwatch kind="backref" label="backref \1" />
          <LegendSwatch kind="gate" label="gate (?=…)" />
        </div>
        <p className="text-[11px]" style={{ color: 'var(--color-faint)' }}>
          hover any edge in the machine to light up the pattern text that built it — hover the
          pattern to light up every edge it produced
        </p>
      </footer>
    </div>
  );
}

function LegendSwatch({ kind, label }: { kind: keyof typeof LEGEND_STYLE; label: string }) {
  const s = LEGEND_STYLE[kind];
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="22" height="8">
        <line x1="0" y1="4" x2="22" y2="4" stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} />
      </svg>
      {label}
    </span>
  );
}

const LEGEND_STYLE = {
  consume: { stroke: 'var(--color-consume)', width: 1.6, dash: undefined },
  epsilon: { stroke: 'var(--color-faint)', width: 1.2, dash: '5 5' },
  assert: { stroke: 'var(--color-accent)', width: 1.4, dash: '2 4' },
  captureOpen: { stroke: 'var(--color-capture)', width: 1.3, dash: '7 4' },
  loopGuard: { stroke: 'var(--color-loop)', width: 1.4, dash: '3 3' },
  backref: { stroke: 'var(--color-backref)', width: 1.6, dash: undefined },
  gate: { stroke: 'var(--color-gate)', width: 1.8, dash: undefined },
};
