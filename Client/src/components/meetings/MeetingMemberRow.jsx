import React from 'react';

const EARLY_BIRD_TIME = '07:25';
const LATE_AFTER = '07:59';

const MeetingMemberRow = ({
  row,
  onChange,
  onOpenActivityPicker,
  onRemoveActivity,
  derivedInfo,
  isReadOnly = false,
}) => {
  const member = row.member || {};
  const memberName = member.name || 'Unknown Member';
  const memberInitials = memberName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const attendance = row.attendance || 'present';
  const arrivalTime = row.arrivalTime || '';
  const walkedOut = Boolean(row.walkedOut);
  const attire = row.attire || 'none';
  const activities = row.activities || [];

  const handleAttendanceChange = (newStatus) => {
    if (isReadOnly) return;
    if (newStatus === 'absent') {
      onChange({
        ...row,
        attendance: 'absent',
        arrivalTime: '',
        walkedOut: false,
        attire: 'none',
        activities: [],
      });
    } else {
      onChange({
        ...row,
        attendance: newStatus,
      });
    }
  };

  const handleTimeChange = (e) => {
    if (isReadOnly) return;
    const timeVal = e.target.value;
    let nextAttendance = attendance;

    if (timeVal) {
      if (timeVal <= EARLY_BIRD_TIME) {
        nextAttendance = 'present';
      } else if (timeVal > LATE_AFTER) {
        nextAttendance = 'late';
      } else {
        nextAttendance = 'present';
      }
    }

    onChange({
      ...row,
      arrivalTime: timeVal,
      attendance: nextAttendance,
    });
  };

  const handleWalkedOutToggle = (e) => {
    if (isReadOnly) return;
    onChange({
      ...row,
      walkedOut: e.target.checked,
    });
  };

  const handleAttireChange = (newAttire) => {
    if (isReadOnly) return;
    onChange({
      ...row,
      attire: newAttire,
    });
  };

  const subtotal = derivedInfo?.subtotal ?? 0;
  const isNegative = subtotal < 0;

  return (
    <div
      className={`rounded-2xl border transition ${
        attendance === 'absent'
          ? 'border-slate-200 bg-slate-50/70'
          : 'border-slate-200 bg-white shadow-2xs hover:border-slate-300'
      } p-4 sm:p-5 space-y-4`}
    >
      {/* Row Header: Member Name & Subtotal */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
            {memberInitials}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 truncate">{memberName}</h4>
            <p className="text-xs text-slate-400 truncate">
              {member.username ? `@${member.username}` : ''}
              {member.phone ? ` • ${member.phone}` : ''}
            </p>
          </div>
        </div>

        {/* Live Subtotal Pill */}
        <div className="shrink-0 flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-xl px-3 py-1 text-xs font-black border ${
              isNegative
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : subtotal > 0
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {isNegative ? subtotal : `+${subtotal}`} pts
          </span>
        </div>
      </div>

      {/* Row Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Attendance Segmented Control */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Attendance
          </label>
          <div className="grid grid-cols-3 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => handleAttendanceChange('present')}
              className={`rounded-lg py-1.5 text-xs font-bold transition ${
                attendance === 'present'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Present
            </button>
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => handleAttendanceChange('late')}
              className={`rounded-lg py-1.5 text-xs font-bold transition ${
                attendance === 'late'
                  ? 'bg-white text-amber-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Late
            </button>
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => handleAttendanceChange('absent')}
              className={`rounded-lg py-1.5 text-xs font-bold transition ${
                attendance === 'absent'
                  ? 'bg-white text-rose-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Absent
            </button>
          </div>
        </div>

        {/* 2. Arrival Time */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-600">
              Arrival Time
            </label>
            {/* Live Timing Badges */}
            {attendance !== 'absent' && arrivalTime && (
              <span>
                {arrivalTime <= EARLY_BIRD_TIME ? (
                  <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    Early bird (+20)
                  </span>
                ) : arrivalTime > LATE_AFTER ? (
                  <span className="inline-flex items-center rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                    Late (-100)
                  </span>
                ) : null}
              </span>
            )}
          </div>
          <input
            type="time"
            value={arrivalTime}
            onChange={handleTimeChange}
            disabled={isReadOnly || attendance === 'absent'}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-brand-600 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
          />
        </div>

        {/* 3. Attire 3-Way Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Attire
          </label>
          <div className="grid grid-cols-3 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              disabled={isReadOnly || attendance === 'absent'}
              onClick={() => handleAttireChange('full')}
              className={`rounded-lg py-1.5 text-xs font-bold transition disabled:opacity-40 ${
                attire === 'full'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Full Attire (Tie + Pin + Badge): +10"
            >
              Full (+10)
            </button>
            <button
              type="button"
              disabled={isReadOnly || attendance === 'absent'}
              onClick={() => handleAttireChange('missing_pin_badge')}
              className={`rounded-lg py-1.5 text-xs font-bold transition disabled:opacity-40 ${
                attire === 'missing_pin_badge'
                  ? 'bg-white text-rose-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Missing Pin & Badge: -100"
            >
              Missing (-100)
            </button>
            <button
              type="button"
              disabled={isReadOnly || attendance === 'absent'}
              onClick={() => handleAttireChange('none')}
              className={`rounded-lg py-1.5 text-xs font-bold transition disabled:opacity-40 ${
                attire === 'none'
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Standard / None: 0"
            >
              None (0)
            </button>
          </div>
        </div>

        {/* 4. Walked Out Toggle */}
        <div className="flex flex-col justify-end">
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Walked Out
          </label>
          <label
            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer transition ${
              walkedOut
                ? 'border-rose-200 bg-rose-50/80 text-rose-800'
                : 'border-slate-200 bg-slate-50 text-slate-600'
            } ${attendance === 'absent' || isReadOnly ? 'pointer-events-none opacity-50' : ''}`}
          >
            <span>Walked out</span>
            <input
              type="checkbox"
              checked={walkedOut}
              onChange={handleWalkedOutToggle}
              disabled={isReadOnly || attendance === 'absent'}
              className="h-4 w-4 rounded-sm border-slate-300 text-rose-600 focus:ring-rose-500"
            />
          </label>
        </div>
      </div>

      {/* Row Activities & Chips */}
      {attendance !== 'absent' && (
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
          {/* Derived Items Chips */}
          {(derivedInfo?.items || []).map((it, idx) => {
            const isItemNeg = it.points < 0;
            return (
              <span
                key={`${it.key || it.criteria?._id || idx}`}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                  isItemNeg
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                <span>
                  {it.name}
                  {it.quantity > 1 ? ` (×${it.quantity})` : ''}
                </span>
                <span className="font-bold">
                  {isItemNeg ? it.points : `+${it.points}`}
                </span>
                {/* Remove button only for custom activities when not read-only */}
                {!isReadOnly && it.type === 'activity' && (
                  <button
                    type="button"
                    onClick={() => onRemoveActivity(row.member, it.criteria?._id || it.criteria)}
                    className="ml-1 text-slate-400 hover:text-rose-600 font-bold"
                    title="Remove activity"
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}

          {/* Add Activity Button */}
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => onOpenActivityPicker(row.member, memberName)}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-brand-300 bg-brand-50/50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100/70 hover:border-brand-400 transition"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add activity</span>
            </button>
          )}
        </div>
      )}

      {/* Absent indicator */}
      {attendance === 'absent' && (
        <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-rose-600">
          <span className="inline-flex items-center rounded-lg bg-rose-50 px-2.5 py-1 border border-rose-200">
            Absent for Weekly BNI Meeting (-100 pts)
          </span>
        </div>
      )}
    </div>
  );
};

export default MeetingMemberRow;

