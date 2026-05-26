import React from 'react';
import './Card.css';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  testId?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  tone?: 'default' | 'sunken';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  as: Tag = 'div',
  testId,
  padding = 'md',
  tone = 'default',
}) => {
  const Component = Tag as any;
  return (
    <Component
      className={`fa-card fa-card--p-${padding} fa-card--${tone} ${className}`.trim()}
      data-testid={testId}
    >
      {children}
    </Component>
  );
};
