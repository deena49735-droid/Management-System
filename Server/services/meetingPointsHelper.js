const Criteria = require('../models/Criteria');
const {
  EARLY_BIRD_TIME,
  LATE_AFTER,
  allowsMultipleQuantity,
} = require('../constants/criteriaConstants');

/**
 * Normalizes date to UTC midnight to ensure consistent indexing and comparison.
 */
const normalizeMeetingDate = (inputDate) => {
  const d = new Date(inputDate);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/**
 * Helper to calculate ISO week number from date
 */
const getWeekNumber = (d) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
};

/**
 * Loads all criteria required for meeting sheet derivation and custom activity selection.
 * Returns an object with:
 * - byKey: Map<string, CriteriaDoc>
 * - byId: Map<string, CriteriaDoc>
 * - allowedActivities: Array<CriteriaDoc>
 */
const loadMeetingCriteria = async () => {
  const criteriaList = await Criteria.find({
    isActive: true,
    $or: [{ category: 'meeting_day' }, { category: 'penalty' }],
  }).lean();

  const byKey = new Map();
  const byId = new Map();

  criteriaList.forEach((c) => {
    byKey.set(c.key, c);
    byId.set(c._id.toString(), c);
  });

  // Allowed custom activities are meeting_day member criteria excluding early_bird and full_attire (which are calculated from timing/attire controls)
  const allowedActivities = criteriaList
    .filter(
      (c) =>
        c.category === 'meeting_day' &&
        c.level === 'member' &&
        c.key !== 'early_bird' &&
        c.key !== 'full_attire'
    )
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  return { byKey, byId, allowedActivities };
};

/**
 * Validates a single row's attendance, attire, walkedOut, and activity rules.
 */
const validateMeetingRow = (row, criteriaHelper) => {
  const errors = [];
  const attendance = row.attendance || 'present';

  if (!['present', 'late', 'absent'].includes(attendance)) {
    errors.push(`Invalid attendance value: ${attendance}`);
  }

  if (attendance === 'absent') {
    if (typeof row.arrivalTime === 'string' && row.arrivalTime.trim() !== '') {
      errors.push('Absent members cannot have an arrival time.');
    }
    if (row.walkedOut) {
      errors.push('Absent members cannot be marked as walked out.');
    }
    if (row.attire && row.attire !== 'none') {
      errors.push('Absent members must have attire set to none.');
    }
    if (row.activities && row.activities.length > 0) {
      errors.push('Absent members cannot have meeting day activities.');
    }
  } else {
    if (row.attire && !['full', 'missing_pin_badge', 'none'].includes(row.attire)) {
      errors.push(`Invalid attire value: ${row.attire}`);
    }

    if (row.activities && Array.isArray(row.activities)) {
      row.activities.forEach((act, idx) => {
        const critId = act.criteria?._id ? act.criteria._id.toString() : act.criteria?.toString();
        const critDoc = criteriaHelper.byId.get(critId) || criteriaHelper.byKey.get(critId);

        if (!critDoc) {
          errors.push(`Activity at index ${idx} references unknown or inactive criteria.`);
          return;
        }

        if (critDoc.category !== 'meeting_day' || critDoc.level !== 'member') {
          errors.push(`Activity "${critDoc.name}" is not an allowed meeting day activity.`);
        }

        if (critDoc.key === 'early_bird' || critDoc.key === 'full_attire') {
          errors.push(
            `Activity "${critDoc.name}" is handled by timing/attire controls and cannot be added manually.`
          );
        }


        const qty = Number(act.quantity);
        if (!qty || qty < 1 || !Number.isInteger(qty)) {
          errors.push(`Activity "${critDoc.name}" has invalid quantity: ${act.quantity}. Must be an integer >= 1.`);
        } else if (!allowsMultipleQuantity(critDoc.basisLabel) && qty > 1) {
          errors.push(
            `Activity "${critDoc.name}" only allows quantity of 1 according to basis (${critDoc.basisLabel}).`
          );
        }
      });
    }
  }

  return errors;
};

/**
 * Derives points and items for a single member row based on timing, attendance, attire, and activities.
 */
const deriveRowPoints = (row, criteriaHelper) => {
  const { byKey, byId } = criteriaHelper;
  const items = [];
  let attendance = row.attendance || 'present';
  const arrivalTime = typeof row.arrivalTime === 'string' ? row.arrivalTime.trim() : '';

  // 1. Arrival time & attendance derivation
  if (attendance === 'absent') {
    const absentCrit = byKey.get('absent_weekly_meeting');
    if (absentCrit) {
      items.push({
        criteria: absentCrit,
        type: 'penalty',
        key: 'absent_weekly_meeting',
        name: absentCrit.name,
        quantity: 1,
        points: absentCrit.points, // -100
        basis: absentCrit.basisLabel || 'Per Member',
      });
    }
    // Return early for absent - no other points apply
    const subtotal = items.reduce((acc, it) => acc + it.points, 0);
    return {
      member: row.member,
      attendance: 'absent',
      arrivalTime: '',
      walkedOut: false,
      attire: 'none',
      activities: [],
      items,
      subtotal,
    };
  }

  // Member is present or late
  if (arrivalTime) {
    if (arrivalTime <= EARLY_BIRD_TIME) {
      attendance = 'present';
      const earlyBirdCrit = byKey.get('early_bird');
      if (earlyBirdCrit) {
        items.push({
          criteria: earlyBirdCrit,
          type: 'bonus',
          key: 'early_bird',
          name: earlyBirdCrit.name,
          quantity: 1,
          points: earlyBirdCrit.points, // +20
          basis: earlyBirdCrit.basisLabel || 'Per Member',
        });
      }
    } else if (arrivalTime > LATE_AFTER) {
      attendance = 'late';
      const lateCrit = byKey.get('late_after_759');
      if (lateCrit) {
        items.push({
          criteria: lateCrit,
          type: 'penalty',
          key: 'late_after_759',
          name: lateCrit.name,
          quantity: 1,
          points: lateCrit.points, // -100
          basis: lateCrit.basisLabel || 'Per Member',
        });
      }
    } else {
      // 07:26 to 07:59 inclusive
      attendance = 'present';
    }
  } else {
    // No arrival time entered - check manual attendance toggle
    if (attendance === 'late') {
      const lateCrit = byKey.get('late_after_759');
      if (lateCrit) {
        items.push({
          criteria: lateCrit,
          type: 'penalty',
          key: 'late_after_759',
          name: lateCrit.name,
          quantity: 1,
          points: lateCrit.points, // -100
          basis: lateCrit.basisLabel || 'Per Member',
        });
      }
    }
  }

  // 2. Walked out penalty
  if (row.walkedOut) {
    const walkedOutCrit = byKey.get('walking_out');
    if (walkedOutCrit) {
      items.push({
        criteria: walkedOutCrit,
        type: 'penalty',
        key: 'walking_out',
        name: walkedOutCrit.name,
        quantity: 1,
        points: walkedOutCrit.points, // -300
        basis: walkedOutCrit.basisLabel || 'Per Member',
      });
    }
  }

  // 3. Attire
  if (row.attire === 'full') {
    const fullAttireCrit = byKey.get('full_attire');
    if (fullAttireCrit) {
      items.push({
        criteria: fullAttireCrit,
        type: 'bonus',
        key: 'full_attire',
        name: fullAttireCrit.name,
        quantity: 1,
        points: fullAttireCrit.points, // +10
        basis: fullAttireCrit.basisLabel || 'Per Member',
      });
    }
  } else if (row.attire === 'missing_pin_badge') {
    const missingBadgeCrit = byKey.get('missing_pin_badge');
    if (missingBadgeCrit) {
      items.push({
        criteria: missingBadgeCrit,
        type: 'penalty',
        key: 'missing_pin_badge',
        name: missingBadgeCrit.name,
        quantity: 1,
        points: missingBadgeCrit.points, // -100
        basis: missingBadgeCrit.basisLabel || 'Per Member',
      });
    }
  }

  // 4. Custom Activities
  if (row.activities && Array.isArray(row.activities)) {
    row.activities.forEach((act) => {
      const critId = act.criteria?._id ? act.criteria._id.toString() : act.criteria?.toString();
      const critDoc = byId.get(critId) || byKey.get(critId);
      if (critDoc) {
        const qty = Number(act.quantity) || 1;
        items.push({
          criteria: critDoc,
          type: 'activity',
          key: critDoc.key,
          name: critDoc.name,
          quantity: qty,
          points: critDoc.points * qty,
          basis: critDoc.basisLabel || 'Per Member',
        });
      }
    });
  }

  const subtotal = items.reduce((acc, it) => acc + it.points, 0);

  return {
    member: row.member,
    attendance,
    arrivalTime,
    walkedOut: Boolean(row.walkedOut),
    attire: row.attire || 'none',
    activities: row.activities || [],
    items,
    subtotal,
  };
};

/**
 * Derives full meeting summary including row-level points, counts, and grand total.
 */
const deriveMeetingSummary = (rows, criteriaHelper) => {
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let totalPoints = 0;

  const derivedRows = (rows || []).map((row) => {
    const derived = deriveRowPoints(row, criteriaHelper);

    if (derived.attendance === 'present') presentCount += 1;
    else if (derived.attendance === 'late') lateCount += 1;
    else if (derived.attendance === 'absent') absentCount += 1;

    totalPoints += derived.subtotal;
    return derived;
  });

  return {
    presentCount,
    lateCount,
    absentCount,
    totalPoints,
    rows: derivedRows,
  };
};

module.exports = {
  normalizeMeetingDate,
  getWeekNumber,
  loadMeetingCriteria,
  validateMeetingRow,
  deriveRowPoints,
  deriveMeetingSummary,
};

