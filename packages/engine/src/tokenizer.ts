/**
 * Tokenizer: pattern string → token stream. Class contents are fully parsed
 * here (they are a self-contained grammar). Every token carries a span.
 */

import type { ClassItem, Span } from './ast';
import { RegexSyntaxError, UnsupportedSyntaxError } from './errors';

export type OpenKind =
  | 'plain' // (
  | 'nonCapture' // (?:
  | 'lookahead' // (?=
  | 'negativeLookahead' // (?!
  | 'lookbehind' // (?<=
  | 'negativeLookbehind'; // (?<!

export type Tok =
  | { t: 'literal'; units: number[]; span: Span }
  | { t: 'dot'; span: Span }
  | { t: 'caret'; span: Span }
  | { t: 'dollar'; span: Span }
  | { t: 'wordB'; negated: boolean; span: Span }
  | { t: 'cls'; negated: boolean; items: ClassItem[]; span: Span }
  | { t: 'escCls'; kind: 'd' | 'w' | 's'; negated: boolean; span: Span }
  | { t: 'numBackref'; n: number; span: Span }
  | { t: 'namedBackref'; name: string; span: Span }
  | { t: 'open'; kind: OpenKind; name?: string; span: Span }
  | { t: 'close'; span: Span }
  | { t: 'bar'; span: Span }
  | { t: 'quant'; min: number; max: number; greedy: boolean; span: Span }
  | { t: 'eof'; span: Span };

const LINE_TERMINATORS = new Set([0x0a, 0x0d, 0x2028, 0x2029]);

function isLineTerminator(cu: number): boolean {
  return LINE_TERMINATORS.has(cu);
}

function hexToNum(s: string): number {
  return parseInt(s, 16);
}

/** Decode one escape that denotes a raw character value. Returns code units. */
function decodeCharEscape(src: string, i: number): { units: number[]; next: number } {
  const c = src[i]!;
  switch (c) {
    case 'n':
      return { units: [0x0a], next: i + 1 };
    case 'r':
      return { units: [0x0d], next: i + 1 };
    case 't':
      return { units: [0x09], next: i + 1 };
    case 'f':
      return { units: [0x0c], next: i + 1 };
    case 'v':
      return { units: [0x0b], next: i + 1 };
    case '0': {
      // \0 is the null char (not octal); \0 followed by digit is unsupported legacy octal
      if (src[i + 1] !== undefined && src[i + 1]! >= '0' && src[i + 1]! <= '9') {
        throw new UnsupportedSyntaxError('Legacy octal escapes are not supported', {
          start: i - 1,
          end: i + 2,
        });
      }
      return { units: [0x00], next: i + 1 };
    }
    case 'x': {
      const h = src.slice(i + 1, i + 3);
      if (!/^[0-9a-fA-F]{2}$/.test(h)) {
        throw new RegexSyntaxError('\\x escape requires two hex digits', { start: i - 1, end: i + 1 });
      }
      return { units: [hexToNum(h)], next: i + 3 };
    }
    case 'u': {
      if (src[i + 1] === '{') {
        throw new UnsupportedSyntaxError('\\u{...} requires the u flag which is not supported', {
          start: i - 1,
          end: i + 2,
        });
      }
      const h = src.slice(i + 1, i + 5);
      if (!/^[0-9a-fA-F]{4}$/.test(h)) {
        throw new RegexSyntaxError('\\u escape requires four hex digits', { start: i - 1, end: i + 1 });
      }
      return { units: [hexToNum(h)], next: i + 5 };
    }
    default:
      throw new Error('unreachable');
  }
}

function isHex(c: string): boolean {
  return /^[0-9a-fA-F]$/.test(c);
}

interface ClassParseResult {
  items: ClassItem[];
  negated: boolean;
  end: number; // index after ']'
}

function parseClassBody(src: string, start: number): ClassParseResult {
  // src[start] === '['
  let i = start + 1;
  let negated = false;
  if (src[i] === '^') {
    negated = true;
    i++;
  }
  const items: ClassItem[] = [];
  const spanOf = (from: number, to: number): Span => ({ start: from, end: to });

  // leading ']' is literal
  let first = true;
  while (true) {
    if (i >= src.length) {
      throw new RegexSyntaxError('Unterminated character class', { start: start, end: src.length });
    }
    if (src[i] === ']' && !first) break;
    first = false;

    let lo: number;
    let atomStart = i;
    const c = src[i]!;
    if (c === '\\') {
      const e = src[i + 1];
      if (e === undefined) {
        throw new RegexSyntaxError('Trailing backslash', { start: i, end: i + 1 });
      }
      if ('dws'.includes(e) || 'DWS'.includes(e)) {
        items.push({ t: 'klass', kind: e.toLowerCase() as 'd' | 'w' | 's', negated: e === e.toUpperCase() });
        i += 2;
        continue;
      }
      if (e === 'b') {
        // JS quirk: \b inside a class is backspace \u0008
        lo = 0x08;
        i += 2;
      } else if ('nrtfv0xu'.includes(e)) {
        const d = decodeCharEscape(src, i + 1);
        lo = d.units[0]!;
        i = d.next;
      } else if (e === 'p' || e === 'P') {
        throw new UnsupportedSyntaxError('Unicode property escapes \\p{...} are not supported', {
          start: i,
          end: Math.min(i + 4, src.length),
        });
      } else if (e === 'c') {
        // control escape \cX
        const x = src[i + 2];
        if (x !== undefined && /[a-zA-Z]/.test(x)) {
          lo = x.toUpperCase().charCodeAt(0) - 64;
          i += 3;
        } else {
          lo = 0x5c; // identity backslash per Annex B
          i += 1;
        }
      } else {
        lo = e.codePointAt(0)!;
        i += 2;
      }
    } else {
      lo = c.codePointAt(0)!;
      i += 1;
    }

    // range?
    if (src[i] === '-' && src[i + 1] !== undefined && src[i + 1] !== ']') {
      let hi: number;
      atomStart = i; // '-' position for error reporting
      i += 1;
      const hc = src[i]!;
      if (hc === '\\') {
        const e = src[i + 1];
        if (e === undefined) throw new RegexSyntaxError('Trailing backslash in class range', { start: i, end: i + 1 });
        if ('dwsDWS'.includes(e)) {
          throw new RegexSyntaxError('Class escape cannot be a range bound', spanOf(atomStart - 1, i + 2));
        }
        if ('b'.includes(e)) {
          hi = 0x08;
          i += 2;
        } else if ('nrtfv0xu'.includes(e)) {
          const d = decodeCharEscape(src, i + 1);
          hi = d.units[0]!;
          i = d.next;
        } else {
          hi = hc.codePointAt(0)!;
          i += 2;
        }
      } else {
        hi = hc.codePointAt(0)!;
        i += 1;
      }
      if (hi < lo) {
        throw new RegexSyntaxError('Range out of order in character class', spanOf(start, i));
      }
      items.push({ t: 'range', lo, hi });
    } else {
      items.push({ t: 'char', cu: lo });
    }
    void atomStart;
  }
  return { items, negated, end: i + 1 };
}

export function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const push = (t: Tok) => toks.push(t);

  while (i < src.length) {
    const start = i;
    const c = src[i]!;
    switch (c) {
      case '.':
        push({ t: 'dot', span: { start, end: i + 1 } });
        i++;
        break;
      case '^':
        push({ t: 'caret', span: { start, end: i + 1 } });
        i++;
        break;
      case '$':
        push({ t: 'dollar', span: { start, end: i + 1 } });
        i++;
        break;
      case '[': {
        const r = parseClassBody(src, i);
        push({ t: 'cls', negated: r.negated, items: r.items, span: { start, end: r.end } });
        i = r.end;
        break;
      }
      case '|':
        push({ t: 'bar', span: { start, end: i + 1 } });
        i++;
        break;
      case '(':
        push(openParen(src, i));
        i = toks[toks.length - 1]!.span.end;
        break;
      case ')':
        push({ t: 'close', span: { start, end: i + 1 } });
        i++;
        break;
      case '*':
        push({ t: 'quant', min: 0, max: Infinity, greedy: true, span: { start, end: i + 1 } });
        i++;
        break;
      case '+':
        push({ t: 'quant', min: 1, max: Infinity, greedy: true, span: { start, end: i + 1 } });
        i++;
        break;
      case '?':
        push({ t: 'quant', min: 0, max: 1, greedy: true, span: { start, end: i + 1 } });
        i++;
        break;
      case '{': {
        const q = tryBraceQuant(src, i);
        if (q) {
          push({ t: 'quant', min: q.min, max: q.max, greedy: q.greedy, span: { start, end: i + q.rawLen } });
          i += q.rawLen;
        } else {
          // not a valid quantifier → literal '{' (Annex B)
          push({ t: 'literal', units: [c.charCodeAt(0)], span: { start, end: i + 1 } });
          i++;
        }
        break;
      }
      case '\\': {
        const tok = escapeToken(src, i);
        push(tok.tok);
        i = tok.next;
        break;
      }
      case ']':
      case '}':
        // unmatched closer is a literal per Annex B
        push({ t: 'literal', units: [c.charCodeAt(0)], span: { start, end: i + 1 } });
        i++;
        break;
      default: {
        const cu = c.codePointAt(0)!;
        if (cu > 0xffff) {
          push({ t: 'literal', units: [c.charCodeAt(0), c.charCodeAt(1)], span: { start, end: i + 2 } });
          i += 2;
        } else {
          push({ t: 'literal', units: [cu], span: { start, end: i + 1 } });
          i++;
        }
      }
    }
  }
  push({ t: 'eof', span: { start: src.length, end: src.length } });
  return toks;
}

function openParen(src: string, i: number): Tok {
  const spanTo = (end: number, kind: OpenKind, name?: string): Tok => ({
    t: 'open',
    kind,
    name,
    span: { start: i, end },
  });
  if (src[i + 1] !== '?') return spanTo(i + 1, 'plain');
  const c2 = src[i + 2];
  if (c2 === ':') return spanTo(i + 3, 'nonCapture');
  if (c2 === '=') return spanTo(i + 3, 'lookahead');
  if (c2 === '!') return spanTo(i + 3, 'negativeLookahead');
  if (c2 === '<') {
    const c3 = src[i + 3];
    if (c3 === '=') return spanTo(i + 4, 'lookbehind');
    if (c3 === '!') return spanTo(i + 4, 'negativeLookbehind');
    // named group (?<name>...)
    const close = src.indexOf('>', i + 3);
    if (close === -1) {
      throw new RegexSyntaxError('Unterminated group name', { start: i, end: src.length });
    }
    const name = src.slice(i + 3, close);
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
      throw new RegexSyntaxError(`Invalid group name "${name}"`, { start: i + 3, end: close });
    }
    return spanTo(close + 1, 'plain', name);
  }
  if (c2 === 'P') {
    throw new UnsupportedSyntaxError('(?)P syntax is not supported', { start: i, end: i + 3 });
  }
  throw new UnsupportedSyntaxError(`Unsupported group modifier "?${c2 ?? ''}"`, { start: i, end: i + 3 });
}

function tryBraceQuant(src: string, i: number): { min: number; max: number; greedy: boolean; rawLen: number } | null {
  // src[i] === '{'
  const close = src.indexOf('}', i);
  if (close === -1) return null;
  const body = src.slice(i + 1, close);
  const m = /^(\d+)(?:,(\d*))?$/.exec(body);
  if (!m) return null;
  const min = parseInt(m[1]!, 10);
  let max: number;
  if (m[2] === undefined) {
    max = min; // {n}
  } else if (m[2] === '') {
    max = Infinity; // {n,}
  } else {
    max = parseInt(m[2]!, 10);
  }
  if (max !== Infinity && max < min) {
    throw new RegexSyntaxError('Quantifier {min,max} out of order', { start: i, end: close + 1 });
  }
  if (min > 1000 || (max !== Infinity && max > 1000)) {
    throw new UnsupportedSyntaxError('Quantifier repetition count too large (max 1000)', {
      start: i,
      end: close + 1,
    });
  }
  let rawLen = close + 1 - i;
  let greedy = true;
  if (src[close + 1] === '?') {
    greedy = false;
    rawLen += 1;
  }
  return { min, max, greedy, rawLen };
}

function escapeToken(src: string, i: number): { tok: Tok; next: number } {
  const e = src[i + 1];
  const at = (n: number) => ({ start: i, end: n });
  if (e === undefined) {
    throw new RegexSyntaxError('Pattern ends with a lone backslash', at(i + 1));
  }
  if ('dws'.includes(e) || 'DWS'.includes(e)) {
    return {
      tok: { t: 'escCls', kind: e.toLowerCase() as 'd' | 'w' | 's', negated: e === e.toUpperCase(), span: at(i + 2) },
      next: i + 2,
    };
  }
  if (e === 'b') return { tok: { t: 'wordB', negated: false, span: at(i + 2) }, next: i + 2 };
  if (e === 'B') return { tok: { t: 'wordB', negated: true, span: at(i + 2) }, next: i + 2 };
  if (e === 'p' || e === 'P') {
    throw new UnsupportedSyntaxError('Unicode property escapes \\p{...} are not supported', at(Math.min(i + 4, src.length)));
  }
  if (/[1-9]/.test(e)) {
    // numeric backref; multi-digit greedy parse of digits forming an existing ref is resolved later
    let j = i + 1;
    while (j < src.length && /[0-9]/.test(src[j]!)) j++;
    const n = parseInt(src.slice(i + 1, j), 10);
    return { tok: { t: 'numBackref', n, span: at(j) }, next: j };
  }
  if (e === 'k') {
    if (src[i + 2] !== '<') {
      throw new RegexSyntaxError('\\k must be followed by <name>', at(i + 2));
    }
    const close = src.indexOf('>', i + 3);
    if (close === -1) throw new RegexSyntaxError('Unterminated backreference name', at(src.length));
    return { tok: { t: 'namedBackref', name: src.slice(i + 3, close), span: at(close + 1) }, next: close + 1 };
  }
  if ('nrtfv0xu'.includes(e)) {
    const d = decodeCharEscape(src, i + 1);
    void isHex;
    return { tok: { t: 'literal', units: d.units, span: at(d.next) }, next: d.next };
  }
  // identity escape: any punctuation (and Annex B letters) matches itself
  return { tok: { t: 'literal', units: [e.codePointAt(0)!], span: at(i + 2) }, next: i + 2 };
}

export { isLineTerminator };
