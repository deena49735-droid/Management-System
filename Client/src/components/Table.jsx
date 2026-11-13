import React from 'react';

const Table = ({
  children,
  className = '',
  containerClassName = '',
}) => {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden ${containerClassName}`}
    >
      <div className="overflow-x-auto">
        <table className={`w-full text-left text-sm text-slate-600 ${className}`}>
          {children}
        </table>
      </div>
    </div>
  );
};

export const TableHeader = ({ children, className = '' }) => (
  <thead
    className={`sticky top-0 z-10 border-b border-slate-200 bg-slate-50/90 backdrop-blur-xs text-xs font-semibold uppercase tracking-wider text-slate-500 ${className}`}
  >
    {children}
  </thead>
);

export const TableBody = ({ children, className = '' }) => (
  <tbody className={`divide-y divide-slate-100 ${className}`}>{children}</tbody>
);

export const TableRow = ({ children, className = '', onClick }) => (
  <tr
    onClick={onClick}
    className={`hover:bg-slate-50/80 transition-colors ${
      onClick ? 'cursor-pointer' : ''
    } ${className}`}
  >
    {children}
  </tr>
);

export const TableHead = ({ children, className = '', align = 'left' }) => {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={`px-4 py-3.5 text-xs font-semibold ${alignClass} ${className}`}>
      {children}
    </th>
  );
};

export const TableCell = ({ children, className = '', align = 'left' }) => {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return <td className={`px-4 py-3.5 ${alignClass} ${className}`}>{children}</td>;
};

export default Table;

