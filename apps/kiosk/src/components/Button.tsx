import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  icon?: ReactNode;
}

export function Button({ variant = 'primary', icon, className, children, ...rest }: ButtonProps) {
  const base = variant === 'primary' ? 'btn-primary' : 'btn-secondary';
  return (
    <button className={`${base} gap-3 ${className ?? ''}`} {...rest}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
