/**
 * AST types. Every node carries a source span (pattern-string offsets,
 * UTF-16 code units). Phase 3 bidirectional highlighting depends on this.
 */

export interface Span {
  /** inclusive start offset in the pattern string */
  start: number;
  /** exclusive end offset in the pattern string */
  end: number;
}

/** A character-class member. All chars are UTF-16 code units. */
export type ClassItem =
  | { t: 'char'; cu: number }
  | { t: 'range'; lo: number; hi: number }
  | { t: 'klass'; kind: 'd' | 'w' | 's'; negated: boolean };

export type GroupKind =
  | 'capture'
  | 'nonCapture'
  | 'lookahead'
  | 'negativeLookahead'
  | 'lookbehind'
  | 'negativeLookbehind';

export type Node =
  | SequenceNode
  | AlternationNode
  | LiteralNode
  | ClassNode
  | DotNode
  | AnchorNode
  | GroupNode
  | QuantifierNode
  | BackrefNode;

export interface SequenceNode {
  type: 'sequence';
  parts: Node[];
  span: Span;
}

export interface AlternationNode {
  type: 'alternation';
  branches: Node[];
  span: Span;
}

/** One or two UTF-16 code units (a lone surrogate is kept as-is, one unit). */
export interface LiteralNode {
  type: 'literal';
  units: number[];
  span: Span;
}

export interface ClassNode {
  type: 'charClass';
  negated: boolean;
  items: ClassItem[];
  span: Span;
}

export interface DotNode {
  type: 'dot';
  span: Span;
}

export type AnchorKind = 'lineStart' | 'lineEnd' | 'wordBoundary' | 'nonWordBoundary';

export interface AnchorNode {
  type: 'anchor';
  kind: AnchorKind;
  span: Span;
}

export interface GroupNode {
  type: 'group';
  kind: GroupKind;
  /** capturing groups only; assigned in open order */
  index?: number;
  /** named capturing groups only */
  name?: string;
  body: Node;
  span: Span;
}

export interface QuantifierNode {
  type: 'quantifier';
  min: number;
  /** Infinity for unbounded */
  max: number;
  greedy: boolean;
  child: Node;
  /** span covers child + quantifier suffix */
  span: Span;
}

export interface BackrefNode {
  type: 'backref';
  /** resolved group index */
  index: number;
  /** present when written as \k<name> */
  name?: string;
  span: Span;
}
