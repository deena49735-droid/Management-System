import React from 'react';

const Card = ({
  children,
  title,
  subtitle,
  action,
  className = '',
  bodyClassName = '',
  headerClassName = '',
  footer,
  ...props
}) => {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-xs transition-shadow ${className}`}
      {...props}
    >
      {(title || subtitle || action) && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-6 sm:py-4 ${headerClassName}`}
        >
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="text-base font-semibold text-slate-900 leading-snug">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0 w-full sm:w-auto">{action}</div>}
        </div>
      )}

      <div className={`p-4 sm:p-6 ${bodyClassName}`}>{children}</div>

      {footer && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 rounded-b-xl sm:px-6">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;

