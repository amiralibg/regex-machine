/**
 * Differential test suite — the definition of engine correctness.
 *
 * Generates pattern/input pairs across all supported syntax, runs both our
 * engine and native RegExp, and asserts identical results: matched or not,
 * match index, every capture group (including named ones).
 *
 * Pairs where our VM exceeds the step limit are skipped BEFORE running
 * native (both engines would be exponential there); each skip is counted
 * and reported.
 */

import { compileRegex, exec } from '../src/index';

// ---------- seeded RNG ----------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- pattern generator ----------

const LITERALS = ['a', 'b', 'c'];
const CLASSES = ['[ab]', '[^a]', '[a-c]', '[b-c1]', '[^bc]', '\\d', '\\w', '\\s', '\\D'];

interface GenCtx {
  rng: () => number;
  groupCount: number;
  depth: number;
}

const pick = <T>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)]!;

function genAtom(ctx: GenCtx): string {
  const { rng } = ctx;
  const r = rng();
  if (r < 0.45) return pick(rng, LITERALS);
  if (r < 0.65) return pick(rng, CLASSES);
  if (r < 0.72) return '.';
  if (r < 0.76) return '^';
  if (r < 0.8) return '$';
  if (r < 0.84) return '\\b';
  if (r < 0.88) return String(1 + Math.floor(rng() * 9)); // digit literal
  return pick(rng, LITERALS);
}

function genGroupBody(ctx: GenCtx): string {
  const { rng } = ctx;
  const r = rng();
  if (r < 0.4 || ctx.depth <= 0) {
    // sequence of 1-3 atoms
    const n = 1 + Math.floor(rng() * 3);
    return Array.from({ length: n }, () => genQuantifiedAtom(ctx)).join('');
  }
  if (r < 0.7) {
    return `${genGroupBody(ctx)}|${genGroupBody(ctx)}`;
  }
  // nested sequence with an inner group
  return `(${genGroupBody(ctx)})${genQuantifiedAtom({ ...ctx, depth: ctx.depth - 1 })}`;
}

function quantifierFor(ctx: GenCtx, atom: string): string {
  const { rng } = ctx;
  const q = rng();
  const lazy = rng() < 0.25 ? '?' : '';
  const unboundedAllowed = !/^[\^\$]|\\b/.test(atom); // anchors get bounded only
  if (!unboundedAllowed) {
    if (q < 0.5) return '?';
    return '';
  }
  if (q < 0.2) return `*${lazy}`;
  if (q < 0.4) return `+${lazy}`;
  if (q < 0.55) return `?${lazy}`;
  if (q < 0.7) return `{${1 + Math.floor(rng() * 2)}}`;
  if (q < 0.85) return `{${Math.floor(rng() * 2)},${3 + Math.floor(rng() * 3)}}${lazy}`;
  return `{${1 + Math.floor(rng() * 2)},}${lazy}`;
}

function genQuantifiedAtom(ctx: GenCtx): string {
  const atom = genAtom(ctx);
  const q = quantifierFor(ctx, atom);
  return atom + q;
}

function genPattern(seed: number): { pattern: string; flags: string } {
  const rng = mulberry32(seed);
  const parts: string[] = [];
  const nGroups = 1 + Math.floor(rng() * 2);
  for (let g = 0; g < nGroups; g++) {
    const named = rng() < 0.3;
    const name = named ? `g${g}` : undefined;
    const body = genGroupBody({ rng, groupCount: g, depth: 2 });
    parts.push(name ? `(?<${name}>${body})` : `(${body})`);
    if (rng() < 0.5 && g === 0) {
      parts.push('\\1'); // backref to the first group
    }
  }
  // sprinkle lookarounds occasionally
  if (rng() < 0.3) {
    const kind = pick(rng, ['(?=\\w)', '(?!x)', '(?<=a)', '(?<!b)', '(?=a|b)']);
    parts.splice(Math.floor(rng() * (parts.length + 1)), 0, kind);
  }
  let pattern = parts.join('');

  const flagSet: string[] = [];
  if (rng() < 0.25) flagSet.push('i');
  if (rng() < 0.15) flagSet.push('m');
  if (rng() < 0.1) flagSet.push('s');
  const flags = flagSet.join('');
  return { pattern, flags };
}

// ---------- input generation ----------

function genInputs(pattern: string, rng: () => number): string[] {
  const alphabet = new Set<string>();
  for (const c of pattern) {
    if (/[abc0-9]/.test(c)) alphabet.add(c);
  }
  alphabet.add('a');
  alphabet.add('b');
  const alpha = [...alphabet].slice(0, 4);
  const inputs = new Set<string>(['']);

  // exhaustive short strings over a reduced alphabet
  const shortAlpha = alpha.slice(0, 2);
  for (let len = 1; len <= 3; len++) {
    const total = shortAlpha.length ** len;
    for (let i = 0; i < total; i++) {
      let s = '';
      let v = i;
      for (let k = 0; k < len; k++) {
        s += shortAlpha[v % shortAlpha.length];
        v = Math.floor(v / shortAlpha.length);
      }
      inputs.add(s);
    }
  }

  // random strings, occasionally with newlines / word-ish variety
  const extra = ['x', ' ', '\n', '1', '_'];
  for (let i = 0; i < 10; i++) {
    const len = Math.floor(rng() * 9);
    let s = '';
    for (let k = 0; k < len; k++) {
      s += rng() < 0.75 ? pick(rng, alpha) : pick(rng, extra);
    }
    inputs.add(s);
  }
  return [...inputs].slice(0, 14);
}

// ---------- comparison ----------

interface Comparison {
  ok: boolean;
  skipped: boolean;
  detail?: string;
}

function compareOne(pattern: string, flags: string, input: string): Comparison {
  let nativeRe: RegExp;
  try {
    nativeRe = new RegExp(pattern, flags.replace(/g/g, ''));
  } catch {
    return { ok: true, skipped: false }; // generator produced invalid syntax; ignore pair
  }

  let ours;
  try {
    const compiled = compileRegex(pattern, flags);
    ours = exec(compiled, input, 0, { stepLimit: 100_000 });
  } catch (e) {
    return { ok: false, skipped: false, detail: `compile threw: ${String(e)} for /${pattern}/${flags}` };
  }
  if (ours.limitExceeded) return { ok: true, skipped: true };

  const nm = nativeRe.exec(input);
  if (!!nm !== ours.matched) {
    return {
      ok: false,
      skipped: false,
      detail: `match mismatch: /${pattern}/${flags} vs ${JSON.stringify(input)}: native=${JSON.stringify(nm?.[0])} ours=${ours.matched}`,
    };
  }
  if (!nm) return { ok: true, skipped: false };

  if (nm.index !== ours.start) {
    return { ok: false, skipped: false, detail: `index mismatch: /${pattern}/${flags} vs ${JSON.stringify(input)}: native=${nm.index} ours=${ours.start}` };
  }
  const nGroups = nm.length - 1;
  if (ours.groups.length !== nGroups) {
    return { ok: false, skipped: false, detail: `group count mismatch: /${pattern}/${flags}: native=${nGroups} ours=${ours.groups.length}` };
  }
  for (let i = 0; i <= nGroups; i++) {
    const nv = i === 0 ? nm[0] : nm[i];
    const ov = i === 0 ? input.slice(ours.start, ours.end) : ours.groups[i - 1];
    if (nv !== ov) {
      return { ok: false, skipped: false, detail: `group ${i} mismatch: /${pattern}/${flags} vs ${JSON.stringify(input)}: native=${JSON.stringify(nv)} ours=${JSON.stringify(ov)}` };
    }
  }
  const nativeNamed = nm.groups ?? {};
  for (const [k, v] of Object.entries(nativeNamed)) {
    if (ours.namedGroups[k] !== v) {
      return { ok: false, skipped: false, detail: `named group ${k} mismatch: /${pattern}/${flags}: native=${JSON.stringify(v)} ours=${JSON.stringify(ours.namedGroups[k])}` };
    }
  }
  return { ok: true, skipped: false };
}

// ---------- curated tricky cases ----------

const CURATED: Array<[string, string, string]> = [
  // empty-match loops
  ['(a*)*', '', ''],
  ['(a*)*', 'b', ''],
  ['(a*)*', 'aaa', ''],
  ['(a*)+', '', ''],
  ['(a?)*', 'aa', ''],
  ['(|a)*', 'aab', ''],
  ['(a|)*', 'aaa', ''],
  ['(?:){3,}', '', ''],
  ['(a{0,2})*', 'aaaaa', ''],
  // alternation order sensitivity
  ['(a|ab)(c|bcd)(d?)', 'abcd', ''],
  ['a|ab', 'ab', ''],
  ['(?:a|ab)+', 'abab', ''],
  ['x(a|ab)y', 'xaby', ''],
  // lazy vs greedy at same position
  ['a*?b', 'aaab', ''],
  ['a+?a+?', 'aaaa', ''],
  ['<.+?>', '<a><bb>', ''],
  ['".*"', '"ab" "cd"', ''],
  ['".*?"', '"ab" "cd"', ''],
  // nested quantifiers
  ['(a+)+', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaab', ''],
  ['^(a+)+$', 'a'.repeat(12) + 'b', ''], // exponential but completes under the step budget
  ['(a|aa)+$', 'aaaaaaaa', ''],
  ['(a*)*b', 'aaab', ''],
  ['((a{0,2}){0,2}){0,2}', 'aaaa', ''],
  // backreferences
  ['(a+)\\1', 'aaaa', ''],
  ['(a+)\\1', 'aaab', ''],
  ['(a|b)\\1+', 'abbb', ''],
  ['(?:(a)|b)\\1', 'ba', ''],
  ['(?:(a)|b)\\1?', 'bx', ''],
  ['(?<n>a+)\\k<n>', 'xaaaaax', ''],
  ['(a)(b)\\2\\1', 'abba', ''],
  ['(a*)b\\1', 'aabaa', ''],
  // lookbehind incl. variable length
  ['(?<=a)b', 'ab', ''],
  ['(?<=a|ab)c', 'abc', ''],
  ['(?<=a|ab)c', 'abxc', ''],
  ['(?<!a)b', 'cb', ''],
  ['(?<!a)b', 'ab', ''],
  ['(?<=^a)b', 'ab', 'm'],
  ['(?<=\\w)\\W', 'a b', ''],
  ['(?<=(a))b', 'ab', ''],
  ['(?!(b))a', 'ab', ''],
  ['(?=(a+))a', 'aaa', ''],
  ['\\bfoo\\b', 'a foo bar', ''],
  // anchors & flags interplay
  ['^b$', 'a\nb\nc', 'm'],
  ['^b$', 'b', ''],
  ['.', '\n', 's'],
  ['.', '\n', ''],
  ['[^\\n]+', 'ab\ncd', ''],
  ['a$', 'a\n', 'm'],
  // classes & escapes
  ['[\\d\\s]+', 'a 12 b', ''],
  ['[^\\w]+', 'ab!!cd', ''],
  ['\\x41+', 'AAB', ''],
  ['\\u0041\\u0042', 'AB', ''],
  ['[]]', ']', ''],
  ['[^]]', 'a', ''],
  ['a{-1}', 'a{-1}', ''],
  ['i', 'Kİk', 'i'], // case folding edge: plain ASCII only matches k/K here
];

// ---------- the suite ----------

describe('differential vs native RegExp (generated)', () => {
  let passCount = 0;
  let skipCount = 0;
  const failures: string[] = [];

  const SEEDS = 140;
  for (let seed = 0; seed < SEEDS; seed++) {
    const { pattern, flags } = genPattern(seed);
    const inputs = genInputs(pattern, mulberry32(seed * 7919 + 13));
    for (const input of inputs) {
      const r = compareOne(pattern, flags, input);
      if (r.skipped) {
        skipCount++;
        continue;
      }
      passCount++;
      if (!r.ok) failures.push(r.detail!);
    }
  }

  it(`generated pairs agree (${passCount} passed, ${skipCount} step-limit skips)`, () => {
    if (failures.length > 0) {
      throw new Error(`${failures.length} failures:\n` + failures.slice(0, 20).join('\n'));
    }
    expect(passCount).toBeGreaterThan(600);
    expect(skipCount).toBeLessThan(passCount / 2);
  });
});

describe('differential vs native RegExp (curated tricky cases)', () => {
  for (const [pattern, input, flags] of CURATED) {
    it(`/${pattern}/${flags} vs ${JSON.stringify(input.slice(0, 20))}`, () => {
      const r = compareOne(pattern, flags, input);
      expect(r.skipped).toBe(false);
      if (!r.ok) throw new Error(r.detail);
    });
  }
});

/**
 * Deliberately excluded from differential equality: these inputs are
 * catastrophic for ANY backtracking engine, so a bounded step budget can
 * never produce an answer to compare. We assert the honest failure mode
 * (limitExceeded) instead of a possibly-wrong one. Phase 5 charts these.
 */
const EXCLUDED_CATASTROPHIC: Array<[string, string]> = [
  ['^(a+)+$', 'a'.repeat(31) + 'b'],
  ['(a|aa)+$', 'a'.repeat(24) + 'b'],
];

describe('deliberately excluded: catastrophic within any step budget', () => {
  for (const [pattern, input] of EXCLUDED_CATASTROPHIC) {
    it(`/${pattern}/ refuses within budget vs ${JSON.stringify(input.slice(0, 12))}+...`, () => {
      const compiled = compileRegex(pattern, '');
      const r = exec(compiled, input, 0, { stepLimit: 100_000 });
      expect(r.limitExceeded).toBe(true);
    });
  }
});
