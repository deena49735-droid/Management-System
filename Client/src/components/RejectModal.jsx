import React, { useState, useEffect } from 'react';
import Modal from './Modal';

const RejectModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Reject Point Entry',
  itemDescription,
  loading = false,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for rejection.');
      return;
    }
    setError('');
    await onConfirm(reason.trim());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {itemDescription && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs sm:text-sm text-slate-700">
            {itemDescription}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
            Rejection Reason <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError('');
            }}
            placeholder="Explain why this entry is being rejected..."
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
              error ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'
            }`}
            autoFocus
          />
          {error && <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 transition disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Rejecting...
              </span>
            ) : (
              'Confirm Rejection'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RejectModal;

