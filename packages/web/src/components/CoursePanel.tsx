import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { COURSE } from '../lib/course';
import type { Exercise, Lesson } from '../lib/course';

const PROGRESS_KEY = 'regex-machine-course-progress';

function loadProgress(): Set<string> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

function saveProgress(done: Set<string>): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify([...done]));
  } catch {
    // private mode etc. — progress just won't persist
  }
}

export function CoursePanel({
  onClose,
  onLoadExercise,
}: {
  onClose: () => void;
  onLoadExercise: (ex: Exercise) => void;
}) {
  const [done, setDone] = useState<Set<string>>(() => loadProgress());
  const [openLessonId, setOpenLessonId] = useState<string | null>('m1l1');

  useEffect(() => {
    saveProgress(done);
  }, [done]);

  const total = useMemo(() => COURSE.reduce((n, m) => n + m.lessons.length, 0), []);

  const completeLesson = (id: string): void => {
    setDone((prev) => new Set(prev).add(id));
    // auto-advance to the next unfinished lesson
    const flat = COURSE.flatMap((m) => m.lessons);
    const idx = flat.findIndex((l) => l.id === id);
    for (let k = idx + 1; k < flat.length; k++) {
      if (!done.has(flat[k]!.id)) {
        setOpenLessonId(flat[k]!.id);
        return;
      }
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.aside
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden"
        style={{ background: 'var(--color-canvas)', borderLeft: '1px solid var(--color-hairline)' }}
        onClick={(e) => e.stopPropagation()}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
      >
        {/* header */}
        <div className="px-5 pt-7 pb-5 sm:px-8" style={{ borderBottom: '1px solid var(--color-hairline)' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Learn regex</h2>
              <p className="mt-1 text-[13px] leading-snug" style={{ color: 'var(--color-body)' }}>
                Five modules. Every lesson ends in the playground, because reading about backtracking is nothing like watching it rewind.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded px-2 py-1 font-mono text-xs hover:bg-white/10"
              style={{ color: 'var(--color-faint)' }}
              aria-label="close course"
            >
              ✕
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--color-panel)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(done.size / total) * 100}%`, background: 'var(--color-accent)' }}
              />
            </div>
            <span className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--color-faint)' }}>
              {done.size}/{total}
            </span>
          </div>
        </div>

        {/* modules */}
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          {COURSE.map((mod, mi) => (
            <section key={mod.id} className="mb-10">
              <header className="mb-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--color-accent)' }}>
                  module {mi + 1} · {mod.lessons.length} lessons
                </div>
                <h3 className="mt-1 text-[15px] font-semibold tracking-tight">{mod.title}</h3>
                <p className="mt-1 text-[12px]" style={{ color: 'var(--color-faint)' }}>
                  {mod.blurb}
                </p>
              </header>

              <div className="flex flex-col">
                {mod.lessons.map((lesson, li) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    number={`${mi + 1}.${li + 1}`}
                    done={done.has(lesson.id)}
                    open={openLessonId === lesson.id}
                    onToggle={() => setOpenLessonId(openLessonId === lesson.id ? null : lesson.id)}
                    onComplete={() => completeLesson(lesson.id)}
                    onLoadExercise={onLoadExercise}
                  />
                ))}
              </div>
            </section>
          ))}

          <p className="pb-4 text-center text-[11px]" style={{ color: 'var(--color-faint)' }}>
            That's the whole course. Break patterns on purpose now — the machine will show you what happens.
          </p>
        </div>
      </motion.aside>
    </motion.div>
  );
}

function LessonCard({
  lesson,
  number,
  done,
  open,
  onToggle,
  onComplete,
  onLoadExercise,
}: {
  lesson: Lesson;
  number: string;
  done: boolean;
  open: boolean;
  onToggle: () => void;
  onComplete: () => void;
  onLoadExercise: (ex: Exercise) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const allCorrect = lesson.quiz.every((q, i) => answers[i] === q.answer);

  return (
    <article
      className="rounded-xl transition-colors"
      style={{
        border: `1px solid ${open ? 'rgba(242,178,62,0.35)' : 'var(--color-hairline)'}`,
        background: open ? 'var(--color-panel)' : 'transparent',
        marginBottom: 8,
      }}
    >
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[9px]"
          style={{
            border: `1px solid ${done ? 'var(--color-accent)' : 'var(--color-hairline)'}`,
            color: done ? 'var(--color-accent)' : 'transparent',
            background: done ? 'rgba(242,178,62,0.12)' : 'transparent',
          }}
        >
          ✓
        </span>
        <span className="font-mono text-[10px] tabular-nums" style={{ color: 'var(--color-faint)' }}>
          {number}
        </span>
        <span
          className="flex-1 text-[13px]"
          style={{ color: open ? 'var(--color-ink)' : 'var(--color-dim)', fontWeight: open ? 600 : 400 }}
        >
          {lesson.title}
        </span>
        <span aria-hidden style={{ color: 'var(--color-faint)', fontSize: 10 }}>
          {open ? '▾' : '▸'}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
        <div className="mx-auto flex max-w-[54ch] flex-col gap-5 px-5 pb-7 pt-1 sm:px-6">
          {/* objective as a lead */}
          <p
            className="pl-3 text-[13px] leading-relaxed"
            style={{ borderLeft: '2px solid var(--color-accent)', color: 'var(--color-ink)' }}
          >
            {lesson.objective}
          </p>

          {/* concepts as prose */}
          <div className="flex flex-col gap-3.5">
            {lesson.concepts.map((c, i) => (
              <p key={i} className="text-[13px] leading-[1.75]" style={{ color: 'var(--color-body)' }}>
                {c}
              </p>
            ))}
          </div>

          {lesson.exercise && (
            <div className="rounded-lg p-4" style={{ background: 'var(--color-canvas)', borderLeft: '2px solid var(--color-capture)' }}>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--color-capture)' }}>
                hands-on
              </div>
              <code
                className="block break-all rounded px-2 py-1.5 font-mono text-[12px]"
                style={{ background: 'var(--color-panel)', color: 'var(--color-ink)' }}
              >
                /{lesson.exercise.pattern}/{lesson.exercise.flags ?? ''} · {JSON.stringify(lesson.exercise.input)}
              </code>
              <p className="mt-3 text-[13px] leading-relaxed" style={{ color: 'var(--color-body)' }}>
                {lesson.exercise.watch}
              </p>
              <button
                onClick={() => onLoadExercise(lesson.exercise!)}
                className="mt-3 rounded-md px-3.5 py-1.5 font-mono text-[12px] font-semibold transition-opacity hover:opacity-85"
                style={{ background: 'var(--color-accent)', color: '#15171e' }}
              >
                load in playground →
              </button>
            </div>
          )}

          {/* quiz */}
          <div className="flex flex-col gap-4">
            {lesson.quiz.map((q, qi) => (
              <div key={qi}>
                <p className="mb-2 text-[13px] font-medium" style={{ color: 'var(--color-ink)' }}>
                  {q.q}
                </p>
                <div className="flex flex-col gap-1.5">
                  {q.options.map((opt, oi) => {
                    const chosen = answers[qi];
                    const revealed = chosen !== undefined;
                    const isChosen = chosen === oi;
                    const correct = oi === q.answer;
                    let bg = 'transparent';
                    let color: string = 'var(--color-body)';
                    let borderColor: string = 'var(--color-hairline)';
                    if (revealed && correct) {
                      bg = 'rgba(242,178,62,0.12)';
                      color = 'var(--color-accent)';
                      borderColor = 'rgba(242,178,62,0.45)';
                    } else if (isChosen && !correct) {
                      bg = 'rgba(239,127,127,0.1)';
                      color = '#ef7f7f';
                      borderColor = 'rgba(239,127,127,0.4)';
                    }
                    return (
                      <button
                        key={oi}
                        onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                        disabled={revealed && isChosen}
                        className="rounded-lg px-3 py-2 text-left font-mono text-[12px] transition-colors hover:bg-white/5"
                        style={{ background: bg, color, border: `1px solid ${borderColor}` }}
                      >
                        {revealed && correct ? '✓ ' : isChosen ? '✗ ' : ''}
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onComplete}
            disabled={(!allCorrect && !done)}
            className="self-start rounded-lg px-3.5 py-1.5 font-mono text-[12px] transition-opacity disabled:cursor-not-allowed disabled:opacity-40 hover:opacity-80"
            style={
              done
                ? { border: '1px solid rgba(242,178,62,0.45)', color: 'var(--color-accent)', background: 'rgba(242,178,62,0.08)' }
                : allCorrect
                  ? { border: '1px solid var(--color-accent)', color: 'var(--color-accent)' }
                  : { border: '1px solid var(--color-hairline)', color: 'var(--color-faint)' }
            }
          >
            {done ? '✓ completed' : allCorrect ? 'mark complete' : 'answer correctly to continue'}
          </button>
        </div>
      </motion.div>
      )}
      </AnimatePresence>
    </article>
  );
}
