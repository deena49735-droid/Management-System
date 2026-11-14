import React from 'react';
import Badge from './Badge';
import ProofImage from './ProofImage';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const EntriesTable = ({
  entries = [],
  loading = false,
  emptyMessage = 'No point entries found.',
  showMember = true,
  renderActions = null,
  prominentProof = false,
}) => {
  if (loading) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500">Loading entries...</p>
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center p-8 text-center">
        <p className="text-sm font-medium text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Mobile Card View (hidden on md and up) */}
      <div className="grid grid-cols-1 divide-y divide-slate-100 md:hidden">
        {entries.map((entry) => {
          const isNegative = (entry.points || 0) < 0;
          return (
            <div
              key={entry._id}
              className="p-4 space-y-3 hover:bg-slate-50/50 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {showMember && (
                    <p className="text-xs font-semibold text-slate-500 truncate">
                      {entry.member?.name
                        ? `${entry.member.name}${entry.member.username ? ` (@${entry.member.username})` : ''}`
                        : (entry.team?.name ? `Team: ${entry.team.name}` : 'Team Entry')}
                    </p>
                  )}
                  <h4 className="text-sm font-semibold text-slate-900 mt-0.5 leading-snug">
                    {entry.criteria?.name || 'Custom Activity'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(entry.date || entry.createdAt)}
                    {entry.weekNumber ? ` • Wk ${entry.weekNumber}` : ''}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold tabular-nums border ${
                      isNegative
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {isNegative ? entry.points : `+${entry.points}`} pts
                  </span>
                  <Badge status={entry.status} size="xs" />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    Qty: <span className="font-bold tabular-nums text-slate-800">{entry.quantity || 1}</span>
                  </span>
                  <div className="shrink-0">
                    <ProofImage src={entry.proofImage} alt={entry.criteria?.name} prominent={prominentProof} />
                  </div>
                </div>
                {entry.enteredBy && (
                  <span className="text-slate-400 text-[11px]">
                    By: {entry.enteredBy.name || entry.submittedBy?.name || 'System'}
                  </span>
                )}
              </div>

              {entry.note && (
                <p className="rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 italic">
                  "{entry.note}"
                </p>
              )}

              {entry.status === 'rejected' && entry.rejectionReason && (
                <div className="rounded-md border border-rose-200 bg-rose-50/70 p-2 text-xs text-rose-800">
                  <span className="font-semibold">Reason:</span> {entry.rejectionReason}
                </div>
              )}

              {renderActions && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                  {renderActions(entry)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Table View (hidden on mobile) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              {showMember && <th className="px-5 py-3">Member / Team</th>}
              <th className="px-5 py-3">Criteria</th>
              <th className="px-4 py-3 text-center">Qty</th>
              <th className="px-4 py-3 text-right">Points</th>
              <th className="px-4 py-3 text-center">Proof</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-4 py-3 text-center">Status</th>
              {renderActions && <th className="px-5 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((entry) => {
              const isNegative = (entry.points || 0) < 0;
              return (
                <tr key={entry._id} className="hover:bg-slate-50/80 transition">
                  {showMember && (
                    <td className="px-5 py-3.5 font-medium text-slate-900 whitespace-nowrap">
                      <span>{entry.member?.name || (entry.team?.name ? `Team: ${entry.team.name}` : '—')}</span>
                      {entry.member?.username && (
                        <span className="block text-xs font-normal text-slate-500">
                          @{entry.member.username}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-slate-900">
                      {entry.criteria?.name || 'Custom Activity'}
                    </p>
                    {entry.note && (
                      <p className="text-xs text-slate-500 italic mt-0.5">
                        "{entry.note}"
                      </p>
                    )}
                    {entry.status === 'rejected' && entry.rejectionReason && (
                      <p className="text-xs text-rose-700 font-medium mt-1">
                        Reason: {entry.rejectionReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center font-semibold tabular-nums text-slate-700">
                    {entry.quantity || 1}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold tabular-nums border ${
                        isNegative
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {isNegative ? entry.points : `+${entry.points}`}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <ProofImage src={entry.proofImage} alt={entry.criteria?.name} prominent={prominentProof} />
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500">
                    {formatDate(entry.date || entry.createdAt)}
                    {entry.weekNumber ? (
                      <span className="block text-[11px] text-slate-400">Wk {entry.weekNumber}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5 text-center whitespace-nowrap">
                    <Badge status={entry.status} size="xs" />
                  </td>
                  {renderActions && (
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {renderActions(entry)}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EntriesTable;
