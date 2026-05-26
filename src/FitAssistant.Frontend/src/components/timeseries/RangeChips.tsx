import React, { useRef } from 'react';
import './RangeChips.css';

export type Range = '24h' | '7d' | '30d';

interface RangeChipsProps {
  value: Range;
  onChange: (next: Range) => void;
  options?: Range[];
  ariaLabel?: string;
}

export const RangeChips: React.FC<RangeChipsProps> = ({
  value,
  onChange,
  options = ['24h', '7d', '30d'],
  ariaLabel = 'Time range',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const idx = options.indexOf(value);
    const next =
      e.key === 'ArrowRight'
        ? options[(idx + 1) % options.length]
        : options[(idx - 1 + options.length) % options.length];
    onChange(next);
    // Move focus to the new selected chip
    requestAnimationFrame(() => {
      containerRef.current
        ?.querySelector<HTMLButtonElement>(`[data-range="${next}"]`)
        ?.focus();
    });
  };

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className="range-chips"
      onKeyDown={handleKey}
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            data-range={opt}
            data-testid={`range-chip-${opt}`}
            className={`range-chips__chip ${active ? 'is-active' : ''}`}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
};
