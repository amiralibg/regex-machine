import { describe, expect, it } from 'vitest';
import { compileRegex, exec } from 'engine';
import { COURSE } from '../src/lib/course';

describe('course content integrity', () => {
  it('every exercise compiles and runs against its input', () => {
    for (const mod of COURSE) {
      for (const lesson of mod.lessons) {
        const ex = lesson.exercise;
        if (!ex) continue;
        let compiled;
        try {
          compiled = compileRegex(ex.pattern, ex.flags ?? '');
        } catch (e) {
          throw new Error(`${lesson.id}: pattern fails to compile: ${ex.pattern} — ${String(e)}`);
        }
        expect(() => exec(compiled, ex.input, 0), lesson.id).not.toThrow();
      }
    }
  });

  it('quiz answers are valid option indices', () => {
    for (const mod of COURSE) {
      for (const lesson of mod.lessons) {
        for (const [qi, q] of lesson.quiz.entries()) {
          expect(q.options.length, `${lesson.id} q${qi}`).toBeGreaterThanOrEqual(2);
          expect(q.answer, `${lesson.id} q${qi}`).toBeGreaterThanOrEqual(0);
          expect(q.answer, `${lesson.id} q${qi}`).toBeLessThan(q.options.length);
        }
      }
    }
  });

  it('has five modules covering the curriculum', () => {
    expect(COURSE.map((m) => m.title)).toEqual([
      'Foundations & Syntax',
      'Groups, Quantifiers, Captures',
      'Inside the Engine',
      'Automata Theory & Optimizations',
      'Performance Engineering & ReDoS',
    ]);
    const lessons = COURSE.flatMap((m) => m.lessons);
    expect(lessons.length).toBe(18);
    // unique ids
    expect(new Set(lessons.map((l) => l.id)).size).toBe(18);
    // every lesson has quiz + objective
    for (const l of lessons) {
      expect(l.objective.length).toBeGreaterThan(10);
      expect(l.concepts.length).toBeGreaterThan(0);
      expect(l.quiz.length).toBeGreaterThan(0);
    }
  });
});
