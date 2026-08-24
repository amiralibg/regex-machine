import { useEffect, useMemo, useState } from 'react';
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
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-xl flex-col overflow-hidden"
        style={{ background: 'var(--color-canvas)', borderLeft: '1px solid var(--color-hairline)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--color-hairline)' }}>
          <div>
            <h2 className="font-mono text-sm font-semibold tracking-tight">learn regex — by seeing it work</h2>
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-faint)' }}>
              {done.size}/{total} lessons complete · exercises load into the playground
            </p>
          </div>
          <button onClick={onClose} className="rounded px-2 py-1 font-mono text-xs hover:bg-white/10" style={{ color: 'var(--color-dim)' }}>
            ✕
          </button>
        </div>

        {/* overall progress bar */}
        <div className="h-1 w-full" style={{ background: 'var(--color-panel)' }}>
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${(done.size / total) * 100}%`, background: 'var(--color-accent)' }}
          />
        </div>

        {/* modules */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {COURSE.map((mod, mi) => (
            <section key={mod.id} className="mb-6">
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-mono text-[11px]" style={{ color: 'var(--color-accent)' }}>
                  MODULE {mi + 1}
                </span>
                <h3 className="text-sm font-semibold">{mod.title}</h3>
              </div>
              <p className="mb-3 text-[11px] leading-snug" style={{ color: 'var(--color-faint)' }}>
                {mod.blurb}
              </p>

              <div className="flex flex-col gap-2">
                {mod.lessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
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
        </div>
      </aside>
    </div>
  );
}

function LessonCard({
  lesson,
  done,
  open,
  onToggle,
  onComplete,
  onLoadExercise,
}: {
  lesson: Lesson;
  done: boolean;
  open: boolean;
  onToggle: () => void;
  onComplete: () => void;
  onLoadExercise: (ex: Exercise) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const allCorrect = lesson.quiz.every((q, i) => answers[i] === q.answer);
  const canComplete = allCorrect && !done;

  return (
    <div className="rounded-lg" style={{ border: '1px solid var(--color-hairline)', background: open ? 'var(--color-panel)' : 'transparent' }}>
      <button onClick={onToggle} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <span
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-mono text-[9px]"
          style={{
            border: `1px solid ${done ? 'var(--color-accent)' : 'var(--color-hairline)'}`,
            color: done ? 'var(--color-accent)' : 'var(--color-faint)',
          }}
        >
          {done ? '✓' : ''}
        </span>
        <span className="flex-1 text-xs" style={{ color: open ? 'var(--color-ink)' : 'var(--color-dim)' }}>
          {lesson.title}
        </span>
        <span style={{ color: 'var(--color-faint)', fontSize: 10 }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 px-3 pb-3">
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-accent)' }}>
            {lesson.objective}
          </p>

          {lesson.concepts.map((c, i) => (
            <p key={i} className="text-[12px] leading-relaxed" style={{ color: 'var(--color-dim)' }}>
              {c}
            </p>
          ))}

          {lesson.exercise && (
            <div className="rounded-md p-3" style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)' }}>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--color-accent)' }}>
                exercise · hands-on
              </div>
              <code className="block break-all font-mono text-[11px]" style={{ color: 'var(--color-ink)' }}>
                /{lesson.exercise.pattern}/{lesson.exercise.flags ?? ''} vs {JSON.stringify(lesson.exercise.input)}
              </code>
              <p className="mt-2 text-[11px] leading-relaxed" style={{ color: 'var(--color-dim)' }}>
                {lesson.exercise.watch}
              </p>
              <button
                onClick={() => onLoadExercise(lesson.exercise!)}
                className="mt-2 rounded px-3 py-1 font-mono text-[11px] transition-opacity hover:opacity-80"
                style={{ border: '1px solid var(--color-accent)', color: 'var(--color-accent)' }}
              >
                load in playground →
              </button>
            </div>
          )}

          {/* quiz */}
          <div className="flex flex-col gap-2">
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--color-faint)' }}>
              check yourself
            </div>
            {lesson.quiz.map((q, qi) => (
              <div key={qi}>
                <p className="mb-1 text-[11px]" style={{ color: 'var(--color-ink)' }}>
                  {qi + 1}. {q.q}
                </p>
                <div className="flex flex-col gap-1">
                  {q.options.map((opt, oi) => {
                    const chosen = answers[qi];
                    const isChosen = chosen === oi;
                    const revealed = chosen !== undefined;
                    const correct = oi === q.answer;
                    let bg = 'transparent';
                    let color: string = 'var(--color-dim)';
                    if (revealed && correct) {
                      bg = 'rgba(242,178,62,0.14)';
                      color = 'var(--color-accent)';
                    } else if (isChosen && !correct) {
                      bg = 'rgba(239,127,127,0.12)';
                      color = '#ef7f7f';
                    }
                    return (
                      <button
                        key={oi}
                        onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                        disabled={revealed && isChosen}
                        className="rounded px-2 py-1 text-left font-mono text-[11px] transition-colors"
                        style={{ background: bg, color, border: '1px solid var(--color-hairline)' }}
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
            onClick={() => {
              onComplete();
              setAnswers({});
            }}
            disabled={!canComplete}
            className="self-start rounded px-3 py-1 font-mono text-[11px] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ border: '1px solid var(--color-hairline)', color: done ? 'var(--color-accent)' : 'var(--color-dim)' }}
          >
            {done ? '✓ completed' : allCorrect ? 'mark complete' : 'answer correctly to complete'}
          </button>
        </div>
      )}
    </div>
  );
}
