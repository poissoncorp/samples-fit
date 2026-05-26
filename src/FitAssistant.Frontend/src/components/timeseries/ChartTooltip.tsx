import React from 'react';

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  unit?: string;
}

/**
 * A clean, theme-aware Recharts tooltip that mirrors Apple Health's
 * compact float: bg-card surface, hairline border, monospaced number.
 */
export const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label, unit }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-input)',
        padding: '8px 12px',
        boxShadow: 'var(--shadow-overlay)',
        fontSize: 12,
        color: 'var(--text)',
        minWidth: 100,
      }}
    >
      {label && (
        <div style={{ color: 'var(--text-mute)', fontSize: 11, marginBottom: 2 }}>{label}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: p.color || p.fill,
              display: 'inline-block',
            }}
          />
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
            {Number(p.value).toLocaleString('en-US')}
          </span>
          {unit && <span style={{ color: 'var(--text-mute)' }}>{unit}</span>}
          {p.name && p.name !== 'value' && (
            <span style={{ color: 'var(--text-mute)', marginLeft: 4 }}>· {p.name}</span>
          )}
        </div>
      ))}
    </div>
  );
};
