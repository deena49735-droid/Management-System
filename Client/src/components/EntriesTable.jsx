import React from 'react';
import { Shield, Users, Calendar } from 'lucide-react';
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
                    <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
                      {entry.member ? (
                        <>
                          <span className="font-semibold text-slate-900">{entry.member.name}</span>
                          {entry.team?.name ? (
                            <span className="inline-flex items-center gap-1 font-medium text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200/60">
                              <Shield className="w-2.5 h-2.5 text-brand-600" />
                              {entry.team.name}
                            </span>
                          ) : (
                            <span className="text-slate-400">No team</span>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          <Users className="w-3 h-3 text-slate-600" />
                          Team: {entry.team?.name || 'Unassigned'}
                        </span>
                      )}
                    </div>
                  )}
                  <h4 className="text-sm font-semibold text-slate-900 leading-snug break-words">
                    {entry.criteria?.name || 'Custom Activity'}
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{formatDate(entry.date || entry.createdAt)}</span>
                    {entry.weekNumber ? (
                      <span className="text-slate-400">• Wk {entry.weekNumber}</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
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

              {/* Metadata block: Quantity, Proof and Submitter */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-700">
                    Qty: <span className="font-bold tabular-nums text-slate-900">{entry.quantity || 1}</span>
                  </span>
                  {entry.proofImage ? (
                    <div className="shrink-0 flex items-center gap-1.5">
                      <span className="text-slate-400 text-[11px]">Proof:</span>
                      <ProofImage src={entry.proofImage} alt={entry.criteria?.name} prominent={prominentProof} />
                    </div>
                  ) : (
                    <span className="text-slate-400 text-[11px] font-medium">No image</span>
                  )}
                </div>
                {entry.enteredBy && (
                  <span className="text-slate-400 text-[11px] truncate max-w-[160px]">
                    By: {entry.enteredBy.name || entry.submittedBy?.name || 'System'}
                  </span>
                )}
              </div>

              {entry.note && (
                <p className="rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 italic break-words border border-slate-100/60">
                  "{entry.note}"
                </p>
              )}

              {entry.status === 'rejected' && entry.rejectionReason && (
                <div className="rounded-md border border-rose-200 bg-rose-50/70 p-2 text-xs text-rose-800 break-words">
                  <span className="font-semibold">Reason:</span> {entry.rejectionReason}
                </div>
              )}

              {renderActions && (
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
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
              {showMember && <th className="px-5 py-3">Member & Team</th>}
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
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {entry.member ? (
                        <div>
                          <div className="font-semibold text-slate-900">{entry.member.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                            {entry.team?.name ? (
                              <span className="inline-flex items-center gap-1 font-medium text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200/60">
                                <Shield className="w-3 h-3 text-brand-600" />
                                {entry.team.name}
                              </span>
                            ) : (
                              <span className="text-slate-400">No team</span>
                            )}
                            {entry.member.email ? (
                              <span className="text-slate-400 truncate max-w-[150px]" title={entry.member.email}>
                                {entry.member.email}
                              </span>
                            ) : entry.member.username ? (
                              <span className="text-slate-400 truncate max-w-[150px]">
                                @{entry.member.username}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="inline-flex items-center gap-1.5 font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
                            <Users className="w-3.5 h-3.5 text-slate-600" />
                            <span>Team: {entry.team?.name || 'Unassigned'}</span>
                          </div>
                          <span className="block text-[11px] text-slate-400 mt-0.5">Team activity entry</span>
                        </div>
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
                      <span className="block text-xs text-slate-400">Wk {entry.weekNumber}</span>
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
