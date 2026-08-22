import type { Span } from './ast';

export class RegexSyntaxError extends Error {
  readonly span: Span;
  constructor(message: string, span: Span) {
    super(`${message} (at ${span.start}..${span.end})`);
    this.name = 'RegexSyntaxError';
    this.span = span;
  }
}

/** Clear refusal of syntax we deliberately do not support. Never silent. */
export class UnsupportedSyntaxError extends Error {
  readonly span: Span;
  constructor(message: string, span: Span) {
    super(`${message} (at ${span.start}..${span.end})`);
    this.name = 'UnsupportedSyntaxError';
    this.span = span;
  }
}
