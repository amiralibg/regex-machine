import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  analyzeReDoS,
  buildDfa,
  compileRegex,
  exec,
  isRegularNfa,
} from "engine";
import type { RegexSyntaxError, Span, UnsupportedSyntaxError } from "engine";
import { dfaToGraph, nfaToGraph } from "./lib/machineGraph";
import { edgeIdLookup, playbackAt } from "./lib/playback";
import { growthFactor, measureGrowth } from "./lib/growth";
import type { GrowthResult } from "./lib/growth";
import { EXAMPLES } from "./lib/examples";
import { readPermalink, writePermalink } from "./lib/permalink";
import type { PermalinkView } from "./lib/permalink";
import { HighlightedGraph } from "./components/HighlightedGraph";
import { PatternStrip } from "./components/PatternStrip";
import { InputStrip } from "./components/InputStrip";
import { PlaybackControls } from "./components/PlaybackControls";
import { GrowthChart } from "./components/GrowthChart";
import { CoursePanel } from "./components/CoursePanel";
import { CourseButton } from "./components/CourseButton";
import type { Exercise } from "./lib/course";

const initial = readPermalink();

function errMessage(e: unknown): string {
  const name = (
    e as
      | InstanceType<typeof RegexSyntaxError>
      | InstanceType<typeof UnsupportedSyntaxError>
  )?.name;
  return `${name ?? "Error"}: ${(e as Error)?.message ?? String(e)}`;
}

export function App() {
  const [pattern, setPattern] = useState(initial.pattern ?? "(a|ab)+c");
  const [flags, setFlags] = useState(initial.flags ?? "");
  const [input, setInput] = useState(initial.input ?? "ababc");
  const [view, setView] = useState<PermalinkView>(initial.view ?? "nfa");
  const [openGate, setOpenGate] = useState<number | null>(null);
  const [hoverChar, setHoverChar] = useState<number | null>(null);
  const [stripHighlight, setStripHighlight] = useState<Span[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [growth, setGrowth] = useState<GrowthResult | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);

  const loadExercise = (ex: Exercise): void => {
    setPattern(ex.pattern);
    setFlags(ex.flags ?? "");
    setInput(ex.input);
    setView("nfa");
    setCourseOpen(false);
  };

  // permalink
  useEffect(() => {
    writePermalink({ pattern, flags, input, view });
  }, [pattern, flags, input, view]);

  const compiled = useMemo(() => {
    try {
      return { ok: true as const, value: compileRegex(pattern, flags) };
    } catch (e) {
      return { ok: false as const, error: errMessage(e) };
    }
  }, [pattern, flags]);

  const regular = compiled.ok ? isRegularNfa(compiled.value.nfa) : true;
  const findings = useMemo(
    () => (compiled.ok ? analyzeReDoS(compiled.value.ast) : []),
    [compiled],
  );

  const nfaGraph = useMemo(
    () => (compiled.ok ? nfaToGraph(compiled.value.nfa) : null),
    [compiled],
  );
  const dfaGraph = useMemo(
    () =>
      compiled.ok && regular ? dfaToGraph(buildDfa(compiled.value.nfa)) : null,
    [compiled, regular],
  );

  const preview = useMemo(() => {
    if (!compiled.ok || input === "") return null;
    const r = exec(compiled.value, input, 0);
    return r;
  }, [compiled, input]);

  const traced = useMemo(() => {
    if (!compiled.ok || input === "") return null;
    const r = exec(compiled.value, input, 0, { trace: true });
    if (r.limitExceeded || !r.trace || r.trace.length > 200_000)
      return { tooBig: true as const };
    return { tooBig: false as const, result: r };
  }, [compiled, input]);

  const nfaViz = useMemo(
    () => (compiled.ok ? nfaToGraph(compiled.value.nfa) : null),
    [compiled],
  );
  const lookup = useMemo(
    () => (nfaViz ? edgeIdLookup(nfaViz) : null),
    [nfaViz],
  );
  const pb = useMemo(
    () =>
      traced && !traced.tooBig && nfaViz
        ? playbackAt(traced.result.trace!, cursor, lookup ?? undefined)
        : null,
    [traced, cursor, lookup, nfaViz],
  );

  useEffect(() => {
    setOpenGate(null);
    setHoverChar(null);
    setStripHighlight(null);
    setCursor(0);
    setPlaying(false);
    setGrowth(null);
  }, [compiled, input]);

  const runGrowth = async (): Promise<void> => {
    if (!compiled.ok) return;
    setMeasuring(true);
    setGrowth(null);
    const result = await measureGrowth(
      compiled.value,
      (n) => "a".repeat(n) + "b",
      36,
    );
    setGrowth(result);
    setMeasuring(false);
  };

  const factor = growth ? growthFactor(growth.points) : null;

  return (
    <motion.div
      className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-6 pt-12 sm:gap-5 sm:p-6 sm:pt-12"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="-rotate-1 font-display text-4xl font-bold leading-none">
          regex-machine
        </h1>
        <div className="flex items-center gap-3">
          <span
            className="hidden text-sm sm:inline"
            style={{ color: "var(--color-faint)" }}
          >
            learn · test · see how it works
          </span>
          <CourseButton onClick={() => setCourseOpen(true)} />
        </div>
      </header>

      {/* inputs */}
      <div
        className="flex flex-col gap-3 rounded-lg p-4"
        style={{
          border: "1px solid var(--color-hairline)",
          background: "var(--color-panel)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-sm"
            style={{ color: "var(--color-dim)" }}
          >
            /
          </span>
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none"
            style={{ color: "var(--color-ink)" }}
          />
          <span
            className="font-mono text-sm"
            style={{ color: "var(--color-dim)" }}
          >
            /
          </span>
          <input
            value={flags}
            onChange={(e) =>
              setFlags(e.target.value.replace(/[^igms]/g, "").slice(0, 4))
            }
            spellCheck={false}
            placeholder="flags"
            className="w-14 shrink-0 bg-transparent font-mono text-sm outline-none"
            style={{ color: "var(--color-accent)" }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className="text-xs uppercase"
            style={{ color: "var(--color-faint)" }}
          >
            test string:
          </span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            className="min-w-[8rem] flex-1 bg-transparent font-mono text-sm outline-none"
            style={{ color: "var(--color-ink)" }}
          />
          {preview && (
            <span
              className="whitespace-nowrap font-mono text-xs"
              style={{
                color: preview.matched
                  ? "var(--color-accent)"
                  : "var(--color-faint)",
              }}
            >
              {preview.matched
                ? `✓ ${JSON.stringify(input.slice(preview.start, preview.end))} @ ${preview.start} · ${preview.stepCount} steps`
                : `no match · ${preview.stepCount} steps`}
            </span>
          )}
        </div>
        {!compiled.ok && (
          <div
            className="rounded px-3 py-2 font-mono text-xs"
            style={{
              background: "rgba(239,127,127,0.08)",
              color: "#ef7f7f",
              border: "1px solid rgba(239,127,127,0.25)",
            }}
          >
            {compiled.error}
          </div>
        )}
        {compiled.ok && (
          <PatternStrip
            pattern={pattern}
            highlight={stripHighlight}
            onHoverChar={setHoverChar}
          />
        )}
      </div>

      {/* ReDoS findings */}
      <AnimatePresence>
        {findings.length > 0 && (
          <motion.div
            key="findings"
            className="flex flex-col gap-2 rounded-lg p-4"
            style={{
              border: "1px solid rgba(242,178,62,0.4)",
              background: "rgba(242,178,62,0.06)",
            }}
            initial={{ opacity: 0, y: -6, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-sm uppercase"
                style={{ color: "var(--color-accent)" }}
              >
                ⚠ potential exponential backtracking
              </span>
              {compiled.ok && (
                <button
                  onClick={() => void runGrowth()}
                  disabled={measuring}
                  className="rounded px-3 py-1 text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{
                    border: "1.5px solid var(--color-accent)",
                    color: "var(--color-accent)",
                  }}
                >
                  {measuring ? "measuring…" : growth ? "re-run" : "prove it →"}
                </button>
              )}
            </div>
            {findings.map((f, i) => (
              <button
                key={i}
                onClick={() => setStripHighlight([f.span])}
                className="rounded px-2 py-1.5 text-left font-mono text-[11px] leading-relaxed transition-colors hover:bg-white/5"
                style={{ color: "var(--color-dim)" }}
              >
                <span style={{ color: "var(--color-accent)" }}>
                  {JSON.stringify(pattern.slice(f.span.start, f.span.end))}
                </span>{" "}
                — {f.message}{" "}
                <span className="opacity-60">(click to locate)</span>
              </button>
            ))}
            {growth && (
              <motion.div
                className="mt-1 flex flex-col gap-1"
                initial={{ opacity: 0, y: 8, filter: "blur(5px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              >
                <GrowthChart points={growth.points} inputDesc={`'a'·n + 'b'`} />
                <p
                  className="text-[11px]"
                  style={{ color: "var(--color-dim)" }}
                >
                  {factor !== null
                    ? `each +4 input chars multiplies the work by ≈${factor.toFixed(1)}× — that straight line on a log scale IS exponential backtracking.`
                    : "the step limit was hit almost immediately — growth beyond this point is unbounded."}
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* examples */}
      <div
        className="rounded-lg px-4 py-3"
        style={{
          border: "1px solid var(--color-hairline)",
          background: "var(--color-panel)",
        }}
      >
        <button
          onClick={() => setExamplesOpen((v) => !v)}
          className="flex w-full items-center justify-between text-sm uppercase"
          style={{ color: "var(--color-dim)" }}
        >
          example library · {EXAMPLES.length} patterns
          <span
            aria-hidden
            style={{ color: "var(--color-faint)", fontSize: 10 }}
          >
            {examplesOpen ? "▾" : "▸"}
          </span>
        </button>
        <AnimatePresence initial={false}>
          {examplesOpen && (
            <motion.div
              key="grid"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: "hidden" }}
            >
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {EXAMPLES.map((ex, i) => (
                  <motion.button
                    key={ex.title}
                    onClick={() => {
                      setPattern(ex.pattern);
                      setFlags(ex.flags ?? "");
                      setInput(ex.input);
                      setView("nfa");
                    }}
                    className="rounded-md p-2.5 text-left transition-colors hover:bg-white/5"
                    style={{ border: "1px solid var(--color-hairline)" }}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: Math.min(i * 0.03, 0.4),
                      duration: 0.25,
                    }}
                  >
                    <div
                      className="font-mono text-xs"
                      style={{
                        color: ex.title.startsWith("catastrophic")
                          ? "var(--color-gate)"
                          : "var(--color-accent)",
                      }}
                    >
                      {ex.title}
                    </div>
                    <div
                      className="mt-1 truncate font-mono text-[11px]"
                      style={{ color: "var(--color-dim)" }}
                    >
                      /{ex.pattern}/{ex.flags ?? ""} vs{" "}
                      {JSON.stringify(ex.input.slice(0, 18))}
                      {ex.input.length > 18 ? "…" : ""}
                    </div>
                    <div
                      className="mt-1 text-[11px] leading-snug"
                      style={{ color: "var(--color-faint)" }}
                    >
                      {ex.note}
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* playback (NFA view only) */}
      {compiled.ok &&
        view === "nfa" &&
        input !== "" &&
        nfaViz &&
        traced &&
        pb && (
          <div className="flex flex-col gap-3">
            <div
              className="rounded-lg px-4 py-2"
              style={{
                border: "1px solid var(--color-hairline)",
                background: "var(--color-panel)",
              }}
            >
              <div
                className="mb-1 text-xs uppercase"
                style={{ color: "var(--color-faint)" }}
              >
                input · playhead
              </div>
              <InputStrip
                input={input}
                pos={pb.pos}
                matchRange={
                  traced && !traced.tooBig && traced.result.matched
                    ? [traced.result.start, traced.result.end]
                    : null
                }
                wasRewind={pb.wasRewind}
              />
            </div>
            {traced.tooBig ? (
              <div
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  border: "1px solid var(--color-hairline)",
                  color: "var(--color-dim)",
                }}
              >
                trace too large to play back — simplify the pattern or shorten
                the input
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
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex overflow-hidden rounded-md"
          style={{ border: "1px solid var(--color-hairline)" }}
        >
          {(["nfa", "dfa"] as const).map((m) => {
            const disabled = m === "dfa" && !regular;
            const active = view === m;
            return (
              <button
                key={m}
                disabled={disabled}
                onClick={() => setView(m)}
                className="relative px-4 py-1.5 text-sm uppercase transition-opacity disabled:cursor-not-allowed"
                style={{ opacity: disabled ? 0.55 : 1 }}
              >
                {active && (
                  <motion.span
                    layoutId="view-pill"
                    className="absolute inset-0 rounded-md"
                    style={{
                      background: "var(--color-raise)",
                      border: "1px solid rgba(242,178,62,0.35)",
                    }}
                    transition={{
                      type: "spring",
                      bounce: 0.18,
                      duration: 0.45,
                    }}
                  />
                )}
                <span
                  className="relative z-10"
                  style={{
                    color: disabled
                      ? "var(--color-faint)"
                      : active
                        ? "var(--color-accent)"
                        : "var(--color-dim)",
                  }}
                >
                  {m}
                </span>
              </button>
            );
          })}
        </div>
        {!regular && (
          <p
            className="text-xs leading-relaxed"
            style={{ color: "var(--color-dim)" }}
          >
            This pattern uses backreferences or lookaround — features of a{" "}
            <em>backtracking</em> matcher, not a regular language. No DFA can
            express them; the NFA shows them as annotated special edges and gate
            chips instead.
          </p>
        )}
      </div>

      {/* graph */}
      {compiled.ok && nfaGraph && (
        <>
          {view === "nfa" ? (
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
              preset="roomy"
            />
          ) : null}
        </>
      )}

      {/* gate inset */}
      {compiled.ok &&
        openGate !== null &&
        compiled.value.nfa.gates[openGate] &&
        view === "nfa" && (
          <HighlightedGraph
            viz={nfaToGraph(compiled.value.nfa.gates[openGate]!.nfa)}
            title={`sub-machine · gate #${openGate}`}
            hoverChar={hoverChar}
            onSpans={setStripHighlight}
          />
        )}

      {/* course */}
      <AnimatePresence>
        {courseOpen && (
          <CoursePanel
            onClose={() => setCourseOpen(false)}
            onLoadExercise={loadExercise}
          />
        )}
      </AnimatePresence>

      <footer className="flex flex-col gap-2 pb-4">
        <div
          className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]"
          style={{ color: "var(--color-faint)" }}
        >
          <LegendSwatch kind="consume" label="consume" />
          <LegendSwatch kind="epsilon" label="ε (epsilon)" />
          <LegendSwatch kind="assert" label="assert ^ $ \b" />
          <LegendSwatch kind="captureOpen" label="capture ( )" />
          <LegendSwatch kind="loopGuard" label="loop ⟲" />
          <LegendSwatch kind="backref" label="backref \1" />
          <LegendSwatch kind="gate" label="gate (?=…)" />
        </div>
        <p className="text-[11px]" style={{ color: "var(--color-faint)" }}>
          hover any edge in the machine to light up the pattern text that built
          it — hover the pattern to light up every edge it produced · the URL
          fragment is your permalink
        </p>
      </footer>
    </motion.div>
  );
}

function LegendSwatch({
  kind,
  label,
}: {
  kind: keyof typeof LEGEND_STYLE;
  label: string;
}) {
  const s = LEGEND_STYLE[kind];
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="22" height="8">
        <line
          x1="0"
          y1="4"
          x2="22"
          y2="4"
          stroke={s.stroke}
          strokeWidth={s.width}
          strokeDasharray={s.dash}
        />
      </svg>
      {label}
    </span>
  );
}

const LEGEND_STYLE = {
  consume: { stroke: "var(--color-consume)", width: 1.6, dash: undefined },
  epsilon: { stroke: "var(--color-faint)", width: 1.2, dash: "5 5" },
  assert: { stroke: "var(--color-accent)", width: 1.4, dash: "2 4" },
  captureOpen: { stroke: "var(--color-capture)", width: 1.3, dash: "7 4" },
  loopGuard: { stroke: "var(--color-loop)", width: 1.4, dash: "3 3" },
  backref: { stroke: "var(--color-backref)", width: 1.6, dash: undefined },
  gate: { stroke: "var(--color-gate)", width: 1.8, dash: undefined },
};
