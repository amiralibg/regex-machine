/**
 * The input string with a playhead. `pos` is the machine's current position;
 * the eventual match range is underlined faintly so the destination is
 * visible while the playhead wanders.
 */
export function InputStrip({
  input,
  pos,
  matchRange,
  wasRewind,
}: {
  input: string;
  pos: number;
  matchRange: [number, number] | null;
  wasRewind: boolean;
}) {
  const cells = input.split('');
  return (
    <div
      className="relative flex items-end gap-px py-1 font-mono text-sm"
      style={{ overflowX: 'auto', flexWrap: 'nowrap', scrollbarWidth: 'thin' }}
    >
      {cells.map((ch, i) => {
        const inMatch = matchRange !== null && i >= matchRange[0] && i < matchRange[1];
        const atHead = i === pos && !wasRewind;
        const atRewind = i === pos && wasRewind;
        return (
          <span
            key={i}
            className="relative inline-flex h-7 w-[1.35rem] shrink-0 items-center justify-center rounded transition-colors duration-75"
            style={{
              color: 'var(--color-dim)',
              background:
                atRewind
                  ? 'rgba(240,127,94,0.22)'
                  : atHead
                    ? 'rgba(242,178,62,0.2)'
                    : 'transparent',
              boxShadow: inMatch ? 'inset 0 -2px 0 rgba(242,178,62,0.35)' : 'none',
            }}
          >
            {ch === ' ' ? '␣' : ch}
          </span>
        );
      })}
      {/* playhead marker — cells are fixed-width so the offset is exact */}
      {pos <= input.length && (
        <span
          className="pointer-events-none absolute -top-1 h-9 select-none text-xs transition-all duration-100"
          style={{
            left: Math.min(pos, input.length) * 22.6,
            transform: 'translateX(-45%)',
            color: wasRewind ? 'var(--color-gate)' : 'var(--color-accent)',
          }}
        >
          {wasRewind ? '▴' : '▾'}
        </span>
      )}
      {input.length === 0 && (
        <span className="text-xs" style={{ color: 'var(--color-faint)' }}>
          empty input
        </span>
      )}
    </div>
  );
}
