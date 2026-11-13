import React from 'react';
import { Loader2 } from 'lucide-react';

const variantStyles = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 border-transparent shadow-xs focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
  secondary:
    'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 active:bg-slate-100 shadow-xs focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 border-transparent shadow-xs focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-transparent focus-visible:ring-2 focus-visible:ring-slate-400',
  outlineDanger:
    'bg-white text-rose-600 border-rose-200 hover:bg-rose-50 active:bg-rose-100 shadow-xs focus-visible:ring-2 focus-visible:ring-rose-400',
};

const sizeStyles = {
  sm: 'h-9 min-h-[36px] px-3 text-xs',
  md: 'h-11 min-h-[44px] px-4 text-sm',
  lg: 'h-12 min-h-[48px] px-5 text-base',
};

const Button = React.forwardRef(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      icon: Icon,
      iconRight: IconRight,
      className = '',
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyle =
      'inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition-all duration-150 select-none disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden';
    const variantStyle = variantStyles[variant] || variantStyles.primary;
    const sizeStyle = sizeStyles[size] || sizeStyles.md;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseStyle} ${variantStyle} ${sizeStyle} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : Icon ? (
          <Icon className="h-4 w-4 shrink-0" />
        ) : null}
        <span>{children}</span>
        {!isLoading && IconRight && <IconRight className="h-4 w-4 shrink-0" />}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;

