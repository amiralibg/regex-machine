/**
 * DFA correctness: for regular patterns, the subset-constructed automaton
 * must agree with native RegExp on where a match can start (language
 * membership per position). Anchored-prefix membership is compared via
 * ^(?:pattern) against the same slice.
 */

import { describe, expect, it } from 'vitest';
import { buildDfa, compileRegex, dfaMatchesAt, exec, isRegularNfa } from '../src/index';

const PATTERNS: Array<[string, string]> = [
  ['a', ''],
  ['a+', ''],
  ['a*b', ''],
  ['a|ab', ''],
  ['(a|b)*abb', ''],
  ['[ab]+', ''],
  ['a{2,3}b?', ''],
  ['^a$', ''],
  ['\\ba\\b', ''],
  ['(a)(b)', ''],
  ['(?:ab)+c', ''],
  ['x(a|b|bc)y', ''],
  ['^', 'm'],
  ['$', 'm'],
  ['.', 's'],
  ['[^b]c', ''],
  ['(a*)*b', ''],
  ['(a|)*', ''],
  ['\\d+\\.\\d+', ''],
  ['\\s\\w', ''],
];

function exhaustive(alphabet: string[], maxLen: number): string[] {
  const out = new Set<string>(['']);
  let frontier = [''];
  for (let len = 1; len <= maxLen; len++) {
    const next: string[] = [];
    for (const s of frontier) {
      for (const c of alphabet) next.push(s + c);
    }
    next.forEach((s) => out.add(s));
    frontier = next;
  }
  return [...out];
}

describe('dfa language equivalence vs native', () => {
  const inputs = exhaustive(['a', 'b', ' ', '\n'], 3);

  for (const [pattern, flags] of PATTERNS) {
    it(`/${pattern}/${flags}`, () => {
      const compiled = compileRegex(pattern, flags);
      expect(isRegularNfa(compiled.nfa)).toBe(true);
      const dfa = buildDfa(compiled.nfa);
      // sticky flag: match must start exactly at lastIndex, anchors keep
      // their absolute coordinates — same predicate as dfaMatchesAt
      const sticky = new RegExp(pattern, (flags + 'y').replace(/g/g, ''));

      for (const input of inputs) {
        for (let pos = 0; pos <= input.length; pos++) {
          sticky.lastIndex = pos;
          const native = sticky.exec(input) !== null;
          const ours = dfaMatchesAt(dfa, input, pos);
          if (native !== ours) {
            throw new Error(
              `/${pattern}/${flags} at ${JSON.stringify(input)} pos=${pos}: native=${native} ours=${ours}`,
            );
          }
        }
      }
      expect(true).toBe(true);
    });
  }

  it('non-regular patterns are flagged', () => {
    for (const p of ['(a)\\1', '(?=a)a', '(?!a)a', '(?<=a)b', '(?<!a)b']) {
      expect(isRegularNfa(compileRegex(p, '').nfa)).toBe(false);
    }
  });

  it('empty pattern matches everywhere in both views', () => {
    const c = compileRegex('', '');
    const dfa = buildDfa(c.nfa);
    expect(dfaMatchesAt(dfa, 'abc', 2)).toBe(true);
    expect(exec(c, 'abc', 0).matched).toBe(true);
  });
});
