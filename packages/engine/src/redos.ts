/**
 * ReDoS static analysis — pure AST walk, no execution.
 *
 * Detects the classic exponential-backtracking shapes:
 *  - nested unbounded quantifiers: `(a+)+`, `(a*)*`, `((ab)?c+)*` …
 *  - ambiguous alternation under an unbounded quantifier: `(a|aa)+`
 *
 * Conservative by design: first-character sets are approximate (classes and
 * dots count as "any character"), so the detector may over-warn but never
 * misses a canonical case. Findings carry spans so the UI can point at the
 * exact construct.
 */

import type { Node, Span } from './ast';

export interface ReDoSFinding {
  span: Span;
  kind: 'nested-unbounded' | 'ambiguous-alternation';
  complexity: 'exponential';
  message: string;
}

/** first-unit approximation: 'any' beats any set; nullable = may match empty */
type First = { chars: Set<number> | 'any'; nullable: boolean };

const ANY: First = { chars: 'any', nullable: false };

function unionFirst(a: First, b: First): First {
  if (a.chars === 'any' || b.chars === 'any') return { chars: 'any', nullable: a.nullable || b.nullable };
  const chars = new Set<number>([...a.chars, ...b.chars]);
  return { chars, nullable: a.nullable || b.nullable };
}

function overlaps(a: First, b: First): boolean {
  if (a.chars === 'any' || b.chars === 'any') {
    // only "overlap" if either side can actually match something
    return !allZeroWidthish(a) || !allZeroWidthish(b);
  }
  for (const c of a.chars) if (b.chars.has(c)) return true;
  return false;
}

function allZeroWidthish(f: First): boolean {
  return f.nullable && f.chars !== 'any' && f.chars.size === 0;
}

function firstOf(n: Node): First {
  switch (n.type) {
    case 'literal': {
      if (n.units.length === 0) return { chars: new Set(), nullable: true };
      return { chars: new Set([n.units[0]!]), nullable: false };
    }
    case 'charClass':
    case 'dot':
      return ANY;
    case 'anchor':
      return { chars: new Set(), nullable: true }; // zero-width
    case 'backref':
      return ANY; // unknown length, unknown content
    case 'alternation':
      return n.branches.map(firstOf).reduce(unionFirst);
    case 'sequence': {
      let acc: First = { chars: new Set(), nullable: true };
      for (const p of n.parts) {
        const f = firstOf(p);
        acc = unionFirst(acc, f);
        if (!f.nullable) break; // later parts cannot affect the first unit
      }
      return acc;
    }
    case 'group':
      return firstOf(n.body);
    case 'quantifier': {
      const inner = firstOf(n.child);
      return { ...inner, nullable: inner.nullable || n.min === 0 };
    }
  }
}

/** unbounded quantifier anywhere below (through groups/sequences/branches) */
function hasUnboundedDescendant(n: Node): boolean {
  switch (n.type) {
    case 'quantifier':
      return n.max === Infinity || hasUnboundedDescendant(n.child);
    case 'group':
      return hasUnboundedDescendant(n.body);
    case 'sequence':
      return n.parts.some(hasUnboundedDescendant);
    case 'alternation':
      return n.branches.some(hasUnboundedDescendant);
    default:
      return false;
  }
}

function containsAmbiguousAlternation(n: Node): boolean {
  switch (n.type) {
    case 'alternation': {
      const firsts = n.branches.map(firstOf);
      for (let i = 0; i < firsts.length; i++) {
        for (let j = i + 1; j < firsts.length; j++) {
          if (overlaps(firsts[i]!, firsts[j]!)) return true;
        }
      }
      return n.branches.some(containsAmbiguousAlternation);
    }
    case 'quantifier':
      return containsAmbiguousAlternation(n.child);
    case 'group':
      return containsAmbiguousAlternation(n.body);
    case 'sequence':
      return n.parts.some(containsAmbiguousAlternation);
    default:
      return false;
  }
}

export function analyzeReDoS(root: Node): ReDoSFinding[] {
  const out: ReDoSFinding[] = [];
  const seen = new Set<string>();

  const report = (span: Span, kind: ReDoSFinding['kind'], message: string): void => {
    const key = `${span.start}:${span.end}:${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ span, kind, complexity: 'exponential', message });
  };

  const walk = (n: Node): void => {
    if (n.type === 'quantifier') {
      if (n.max === Infinity) {
        if (hasUnboundedDescendant(n.child)) {
          report(
            n.span,
            'nested-unbounded',
            'unbounded quantifier inside an unbounded quantifier — the engine can split the input between them in exponentially many ways',
          );
        } else if (containsAmbiguousAlternation(n.child)) {
          report(
            n.span,
            'ambiguous-alternation',
            'alternation branches overlap under a quantifier — failed matches force exponentially many re-tries',
          );
        }
      }
      walk(n.child);
      return;
    }
    if (n.type === 'group') {
      walk(n.body);
      return;
    }
    if (n.type === 'sequence') {
      n.parts.forEach(walk);
      return;
    }
    if (n.type === 'alternation') {
      n.branches.forEach(walk);
      return;
    }
  };

  walk(root);
  return out;
}
