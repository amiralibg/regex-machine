/**
 * Public API of the regex-machine engine.
 * Zero React, zero DOM — a standalone library.
 */

import type { Node } from './ast';
import { parseFlags, buildNfa } from './nfa';
import type { Flags, Nfa } from './nfa';
import { parse } from './parser';
import { findMatch } from './vm';
import type { CompiledRegex, ExecOptions, SearchOutcome } from './vm';
import { buildDfa, dfaMatchesAt, isRegularNfa, matcherKey, matcherLabel } from './dfa';
import type { Dfa, DfaEdge, DfaSym } from './dfa';

export type { Node, Span, ClassItem, GroupKind } from './ast';
export type {
  Nfa,
  Gate,
  Trans,
  ConsumeMatcher,
  Flags,
} from './nfa';
export type { MatchResult, TraceEvent } from './trace';
export type { ExecOptions, SearchOutcome, CompiledRegex } from './vm';
export type { Dfa, DfaEdge, DfaSym } from './dfa';
export { buildDfa, dfaMatchesAt, isRegularNfa, matcherKey, matcherLabel } from './dfa';
export { RegexSyntaxError, UnsupportedSyntaxError } from './errors';

/** Compile a pattern + flags to an executable machine (also keeps the AST). */
export function compileRegex(
  pattern: string,
  flags = '',
): CompiledRegex & { ast: Node; parsedFlags: Flags; nfa: Nfa } {
  const fl = parseFlags(flags);
  const { root, groupCount, names } = parse(pattern);
  const nfa = buildNfa(root, fl, groupCount);
  return { pattern, flags, ast: root, parsedFlags: fl, nfa, names };
}

/**
 * Run a leftmost search. `from` is the start offset (for `g` iteration by
 * callers). Never throws on non-matching input; syntax errors throw at
 * compile time.
 */
export function exec(
  compiled: CompiledRegex,
  input: string,
  from = 0,
  opts: ExecOptions = {},
): SearchOutcome {
  return findMatch(compiled, input, from, opts);
}

export { compileRegex as compile };
export { analyzeReDoS } from './redos';
export type { ReDoSFinding } from './redos';
