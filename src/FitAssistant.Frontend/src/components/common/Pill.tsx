import React from 'react';
import './Pill.css';

interface PillProps {
  children: React.ReactNode;
  tone?: 'neutral' | 'agent' | 'fallback' | 'red' | 'green' | 'blue' | 'yellow' | 'purple';
  size?: 'xs' | 'sm';
  icon?: React.ReactNode;
  className?: string;
}

export const Pill: React.FC<PillProps> = ({
  children,
  tone = 'neutral',
  size = 'sm',
  icon,
  className = '',
}) => {
  return (
    <span className={`fa-pill fa-pill--${tone} fa-pill--${size} ${className}`.trim()}>
      {icon && <span className="fa-pill__icon">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
