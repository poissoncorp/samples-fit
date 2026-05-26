import React from 'react';
import './Button.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
  children: React.ReactNode;
  testId?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  loading = false,
  disabled,
  children,
  className = '',
  testId,
  type = 'button',
  ...rest
}) => {
  return (
    <button
      type={type}
      className={`fa-btn fa-btn--${variant} fa-btn--${size} ${loading ? 'is-loading' : ''} ${className}`.trim()}
      disabled={disabled || loading}
      data-testid={testId}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="fa-btn__spinner" aria-hidden="true" /> : iconLeft && <span className="fa-btn__icon">{iconLeft}</span>}
      <span className="fa-btn__label">{children}</span>
      {!loading && iconRight && <span className="fa-btn__icon">{iconRight}</span>}
    </button>
  );
};
