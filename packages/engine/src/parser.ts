/**
 * Recursive-descent parser: tokens → spanned AST.
 * Refuses unsupported syntax loudly; never silently mis-parses.
 */

import type { GroupKind, Node, Span } from './ast';
import { RegexSyntaxError } from './errors';
import type { Tok } from './tokenizer';
import { tokenize } from './tokenizer';

class Parser {
  private pos = 0;
  private groupCount = 0;
  readonly names = new Map<string, number>();

  constructor(private readonly toks: Tok[]) {}

  private peek(): Tok {
    return this.toks[this.pos]!;
  }

  private next(): Tok {
    return this.toks[this.pos++]!;
  }

  parse(): { root: Node; groupCount: number; names: Map<string, number> } {
    const root = this.parseAlternation();
    const eof = this.peek();
    if (eof.t !== 'eof') {
      throw new RegexSyntaxError('Unmatched closing parenthesis', eof.span);
    }
    return { root, groupCount: this.groupCount, names: this.names };
  }

  private parseAlternation(): Node {
    const startTok = this.peek();
    const branches: Node[] = [this.parseSequence()];
    while (this.peek().t === 'bar') {
      this.next();
      branches.push(this.parseSequence());
    }
    if (branches.length === 1) return branches[0]!;
    const end = this.peek().span.start;
    // span covers first branch start .. before ')' or EOF
    return { type: 'alternation', branches, span: join(startTok.span, { start: end, end }) };
  }

  private parseSequence(): Node {
    const parts: Node[] = [];
    const startSpan = this.peek().span;
    while (true) {
      const t = this.peek();
      if (t.t === 'eof' || t.t === 'bar' || t.t === 'close') break;
      parts.push(this.parseQuantified());
    }
    if (parts.length === 0) {
      // empty branch — valid (matches empty string)
      const s = startSpan;
      return { type: 'sequence', parts, span: { start: s.start, end: s.start } };
    }
    if (parts.length === 1) return parts[0]!;
    return {
      type: 'sequence',
      parts,
      span: join(parts[0]!.span, parts[parts.length - 1]!.span),
    };
  }

  private parseQuantified(): Node {
    const atom = this.parseAtom();
    const t = this.peek();
    if (t.t !== 'quant') return atom;
    this.next();
    let greedy = t.greedy;
    // a '?' directly after *, +, ? or {n,m} is always the lazy modifier
    const nxt = this.peek();
    if (nxt.t === 'quant' && nxt.min === 0 && nxt.max === 1) {
      this.next();
      greedy = false;
    }
    // reject double quantifiers like a** (native: "Nothing to repeat")
    if (this.peek().t === 'quant') {
      throw new RegexSyntaxError('Nothing to repeat', this.peek().span);
    }
    return {
      type: 'quantifier',
      min: t.min,
      max: t.max,
      greedy,
      child: atom,
      span: { start: atom.span.start, end: t.span.end },
    };
  }

  private parseAtom(): Node {
    const t = this.next();
    switch (t.t) {
      case 'literal':
        return { type: 'literal', units: t.units, span: t.span };
      case 'dot':
        return { type: 'dot', span: t.span };
      case 'caret':
        return { type: 'anchor', kind: 'lineStart', span: t.span };
      case 'dollar':
        return { type: 'anchor', kind: 'lineEnd', span: t.span };
      case 'wordB':
        return { type: 'anchor', kind: t.negated ? 'nonWordBoundary' : 'wordBoundary', span: t.span };
      case 'cls':
        return { type: 'charClass', negated: t.negated, items: t.items, span: t.span };
      case 'escCls':
        // negation lives solely on the class (\W ≡ [^\w]); item stays positive
        return { type: 'charClass', negated: t.negated, items: [{ t: 'klass', kind: t.kind, negated: false }], span: t.span };
      case 'numBackref':
        return { type: 'backref', index: t.n, span: t.span }; // resolved/validated in post-pass
      case 'namedBackref':
        return { type: 'backref', index: -1, name: t.name, span: t.span };
      case 'open': {
        // capture indices are assigned by OPENING paren order (ES rule),
        // i.e. before the body is parsed — never after
        const kind = groupKindOf(t);
        let index: number | undefined;
        if (kind === 'capture') {
          index = ++this.groupCount;
          if (t.name !== undefined) {
            if (this.names.has(t.name)) {
              throw new RegexSyntaxError(`Duplicate capture group name "${t.name}"`, t.span);
            }
            this.names.set(t.name, index);
          }
        }
        const body = this.parseAlternation();
        const close = this.next();
        if (close.t !== 'close') {
          throw new RegexSyntaxError('Unterminated group', t.span);
        }
        return this.finishGroup(t, body, { start: t.span.start, end: close.span.end }, index);
      }
      case 'close':
        throw new RegexSyntaxError('Unmatched closing parenthesis', t.span);
      case 'bar':
        this.pos--; // empty left branch handled by caller
        throw new RegexSyntaxError('Internal tokenizer state error', t.span);
      default:
        throw new RegexSyntaxError(`Unexpected token ${t.t}`, t.span);
    }
  }

  private finishGroup(
    open: Extract<Tok, { t: 'open' }>,
    body: Node,
    span: Span,
    index: number | undefined,
  ): Node {
    const kind = groupKindOf(open);
    if (kind === 'capture') {
      if (open.name !== undefined) {
        return { type: 'group', kind, index: index!, name: open.name, body, span };
      }
      return { type: 'group', kind, index: index!, body, span };
    }
    return { type: 'group', kind, body, span };
  }

  /** Validate numeric backrefs against total group count (two-pass). */
  resolveBackrefs(root: Node, totalGroups: number): void {
    const walk = (n: Node): void => {
      switch (n.type) {
        case 'backref':
          if (n.name !== undefined) {
            const idx = this.names.get(n.name);
            if (idx === undefined) {
              throw new RegexSyntaxError(`Reference to undefined group name "${n.name}"`, n.span);
            }
            n.index = idx;
          } else if (n.index > totalGroups) {
            throw new RegexSyntaxError(`Reference to nonexistent group \\${n.index}`, n.span);
          }
          return;
        case 'sequence':
          n.parts.forEach(walk);
          return;
        case 'alternation':
          n.branches.forEach(walk);
          return;
        case 'group':
        case 'quantifier':
          walk(n.type === 'group' ? n.body : n.child);
          return;
        default:
          return;
      }
    };
    walk(root);
  }
}

function groupKindOf(open: Extract<Tok, { t: 'open' }>): GroupKind {
  switch (open.kind) {
    case 'plain':
      return 'capture';
    case 'nonCapture':
      return 'nonCapture';
    case 'lookahead':
      return 'lookahead';
    case 'negativeLookahead':
      return 'negativeLookahead';
    case 'lookbehind':
      return 'lookbehind';
    case 'negativeLookbehind':
      return 'negativeLookbehind';
  }
}

function join(a: Span, b: Span): Span {
  return { start: a.start, end: b.end };
}

export function parse(pattern: string): { root: Node; groupCount: number; names: Map<string, number> } {
  const p = new Parser(tokenize(pattern));
  const result = p.parse();
  p.resolveBackrefs(result.root, result.groupCount);
  return result;
}
