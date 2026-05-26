import React from 'react';

interface ProgressRingProps {
  value: number;
  max: number;
  size?: number;
  thickness?: number;
  /** Stroke color for the progress arc — accepts CSS color or var(--ring-*). */
  color?: string;
  /** Background ring color */
  trackColor?: string;
  /** Inner content (e.g. an icon or value) */
  children?: React.ReactNode;
  ariaLabel?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  max,
  size = 64,
  thickness = 8,
  color = 'var(--ring-blue)',
  trackColor = 'var(--bg-sunken)',
  children,
  ariaLabel,
}) => {
  const safeMax = Math.max(1, max);
  const ratio = Math.max(0, Math.min(1.5, value / safeMax)); // allow > 100% for over-goal
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = Math.min(circumference, circumference * ratio);

  return (
    <div
      className="progress-ring"
      style={{ position: 'relative', width: size, height: size, display: 'inline-flex' }}
      role="img"
      aria-label={ariaLabel ?? `${Math.round(ratio * 100)}% of goal`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray var(--motion-slow) var(--ease)' }}
        />
      </svg>
      {children && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};
