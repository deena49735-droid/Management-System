import React from 'react';
import { Inbox } from 'lucide-react';
import Button from './Button';

const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There are no items to display at this time.',
  actionLabel,
  onAction,
  actionButton,
  className = '',
}) => {
  return (
    <div
      className={`flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 mb-3 border border-slate-100">
        <Icon className="h-6 w-6" />
      </div>
      <h4 className="text-base font-semibold text-slate-900 leading-snug">
        {title}
      </h4>
      <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>

      {actionButton ? (
        <div className="mt-4">{actionButton}</div>
      ) : actionLabel && onAction ? (
        <div className="mt-4">
          <Button size="sm" variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default EmptyState;

