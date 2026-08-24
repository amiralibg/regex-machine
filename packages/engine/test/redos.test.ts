import { describe, expect, it } from 'vitest';
import { analyzeReDoS, compileRegex } from '../src/index';

const findings = (pattern: string) => analyzeReDoS(compileRegex(pattern, '').ast);

describe('analyzeReDoS', () => {
  it('flags nested unbounded quantifiers', () => {
    for (const p of ['(a+)+b', '(a*)*b', '((ab)?c+)*d', '(\\w+)+\\.', '(a+)+?b']) {
      const f = findings(p);
      expect(f.length, p).toBeGreaterThan(0);
      expect(f[0]!.kind).toBe('nested-unbounded');
      expect(f[0]!.complexity).toBe('exponential');
    }
  });

  it('flags overlapping alternation under a quantifier', () => {
    for (const p of ['(a|aa)+$', '(?:a|ab)+c']) {
      const f = findings(p);
      expect(f.length, p).toBeGreaterThan(0);
      expect(f[0]!.kind).toBe('ambiguous-alternation');
    }
  });

  it('spans point at the offending quantifier', () => {
    const f = findings('x(a+)+y');
    expect(f).toHaveLength(1);
    expect(f[0]!.span).toEqual({ start: 1, end: 6 });
  });

  it('clears safe patterns', () => {
    for (const p of ['a+', 'a*b?', '(?:ab|cd)+', '\\d{1,3}\\.\\d{1,3}', '[abc]+', 'a{2,4}', '^\\w+$']) {
      expect(findings(p), p).toHaveLength(0);
    }
  });

  it('does not flag bounded nesting alone', () => {
    expect(findings('(a{0,2}){0,2}')).toHaveLength(0);
  });

  it('finds issues deep inside groups and alternations', () => {
    const f = findings('^(?:x|(y+)+)$');
    expect(f.length).toBe(1);
  });
});
