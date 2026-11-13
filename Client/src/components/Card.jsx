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
          className={`flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6 ${headerClassName}`}
        >
          <div>
            {title && (
              <h3 className="text-base font-semibold text-slate-900 leading-snug">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}

      <div className={`p-5 sm:p-6 ${bodyClassName}`}>{children}</div>

      {footer && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 rounded-b-xl sm:px-6">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;

