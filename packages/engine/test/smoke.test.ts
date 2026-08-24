import { compileRegex, exec } from '../src/index';

const cases: Array<[string, string, string]> = [
  ['abc', 'xabcyz', ''],
  ['a+', 'caaab', ''],
  ['a*?b', 'aaab', ''],
  ['(a|ab)(c|bcd)', 'abcd', ''],
  ['(a*)*', '', ''],
  ['(a*)*', 'aaa', ''],
  ['(?<w>\\d{2,4})-(?<m>\\d{1,2})', 'date: 2024-11-3!', ''],
  // catastrophic shape kept small so NATIVE stays quick; ours refuses via
  // step limit (limitExceeded) and the equality branch is skipped
  ['^(a+)+$', 'a'.repeat(22) + 'b', ''],
  ['(?<=ab|abc)c', 'xxabcc', ''],
  ['(?<!a)b', 'ab xb', ''],
  ['(?=(a+))a', 'aaa', ''],
  ['(a)\\1', 'xabxay', ''],
  ['[a-c]+i', 'ABCi', 'i'],
  ['a.c', 'a\nc', 's'],
];

describe('smoke', () => {
  for (const [pattern, input, flags] of cases) {
    it(`${pattern} vs ${JSON.stringify(input)} (${flags})`, () => {
      const c = compileRegex(pattern, flags);
      const ours = exec(c, input, 0, { trace: false });
      const native = new RegExp(pattern, flags.replace(/g/, '')).exec(input);
      expect(ours.matched).toBe(native !== null);
      if (native) {
        expect(ours.start).toBe(native.index);
        expect(input.slice(ours.start, ours.end)).toBe(native[0]);
        expect(ours.groups).toEqual(native.slice(1));
        expect(ours.namedGroups).toEqual({ ...(native.groups ?? {}) });
      }
    });
  }
});
