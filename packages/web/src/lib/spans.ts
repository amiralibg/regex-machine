import type { Span } from 'engine';

/**
 * Which pattern characters are covered by any of `spans`?
 * One boolean per UTF-16 code unit — the strip highlights per character.
 */
export function coveredChars(length: number, spans: readonly Span[]): boolean[] {
  const out = new Array<boolean>(length).fill(false);
  for (const s of spans) {
    const from = Math.max(0, Math.min(s.start, length));
    const to = Math.max(0, Math.min(s.end, length));
    for (let i = from; i < to; i++) out[i] = true;
  }
  return out;
}

/** Do any of `spans` cover character index `i`? */
export function spansCover(spans: readonly Span[], i: number): boolean {
  return spans.some((s) => i >= s.start && i < s.end);
}
