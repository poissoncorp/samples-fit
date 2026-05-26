import React from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  size = 'md',
}) => {
  return (
    <div className={`fa-empty fa-empty--${size}`}>
      {icon && <div className="fa-empty__icon" aria-hidden="true">{icon}</div>}
      <div className="fa-empty__title">{title}</div>
      {description && <div className="fa-empty__desc">{description}</div>}
      {action && <div className="fa-empty__action">{action}</div>}
    </div>
  );
};
