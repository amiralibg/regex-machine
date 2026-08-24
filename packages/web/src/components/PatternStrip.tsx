import type { Span } from 'engine';
import { coveredChars } from '../lib/spans';

/**
 * The pattern rendered as per-character cells. Hovering a cell reports the
 * char index; cells covered by `highlight` (spans arriving FROM the graph)
 * are lit. Bidirectional highlighting's pattern side.
 */
export function PatternStrip({
  pattern,
  highlight,
  onHoverChar,
}: {
  pattern: string;
  highlight: Span[] | null;
  onHoverChar: (index: number | null) => void;
}) {
  const covered = highlight ? coveredChars(pattern.length, highlight) : null;

  return (
    <div
      className="flex flex-wrap items-end gap-px py-1 font-mono text-sm"
      onMouseLeave={() => onHoverChar(null)}
    >
      {/* one cell PER UTF-16 CODE UNIT: spans are unit offsets */}
      {pattern.split('').map((ch, i) => {
        const isCovered = covered?.[i] === true;
        return (
          <span
            key={i}
            onMouseEnter={() => onHoverChar(i)}
            className="relative inline-flex h-7 min-w-[1.4rem] cursor-crosshair items-center justify-center rounded transition-colors duration-75"
            style={{
              color: isCovered ? 'var(--color-ink)' : 'var(--color-dim)',
              background: isCovered ? 'rgba(242,178,62,0.16)' : 'transparent',
              boxShadow: isCovered ? 'inset 0 -2px 0 var(--color-accent)' : 'inset 0 0 0 1px transparent',
            }}
          >
            {ch === ' ' ? '␣' : ch}
          </span>
        );
      })}
      {pattern.length === 0 && (
        <span className="text-xs" style={{ color: 'var(--color-faint)' }}>
          empty pattern — hover a graph edge instead
        </span>
      )}
    </div>
  );
}
