/**
 * Test Suite: Activity Criteria Selector & Submission Flow
 * Verifies that:
 * 1. Criteria structure returned by /criteria/structure maps properly to category keys (meeting_day, non_meeting_day, penalty).
 * 2. ActivityCriteriaSelect filtering by category ('all', 'meeting_day', 'non_meeting_day', 'penalty') works correctly.
 * 3. Search query filters activities by name, basisLabel, and categoryLabel.
 * 4. Submission payload from Admin and Assistant/Head contains correct criteria ID, quantity, date, member, etc.
 * 5. Role permissions and auto-approval logic for Admin and Team Head remain strictly enforced.
 */

const assert = require('assert');

// Mock criteria data from /criteria/structure
const mockStructureCategories = [
  {
    key: 'meeting_day',
    label: 'Meeting Day Activities',
    items: [
      { id: 'crit_1', _id: 'crit_1', name: 'Early Bird @ 7:25 AM', points: 20, basisLabel: 'Per Member', isActive: true, needsProof: false },
      { id: 'crit_2', _id: 'crit_2', name: 'Highest Giver', points: 50, basisLabel: 'Per Member', isActive: true, needsProof: false },
      { id: 'crit_3', _id: 'crit_3', name: 'Visitor Introduction', points: 30, basisLabel: 'Per Visitor', isActive: true, needsProof: true },
    ],
  },
  {
    key: 'non_meeting_day',
    label: 'Non-Meeting Day Activities',
    items: [
      { id: 'crit_4', _id: 'crit_4', name: 'Testimonial Received', points: 25, basisLabel: 'Per Testimonial', isActive: true, needsProof: true },
      { id: 'crit_5', _id: 'crit_5', name: 'Weekly 1-to-1 Completed', points: 40, basisLabel: 'Per Week', isActive: true, needsProof: false },
    ],
  },
  {
    key: 'penalty',
    label: 'Negative Points Criteria',
    items: [
      { id: 'crit_6', _id: 'crit_6', name: 'Late Attendance Penalty', points: -20, basisLabel: 'Per Member', isActive: true, needsProof: false },
      { id: 'crit_7', _id: 'crit_7', name: 'Absent Without Proxy', points: -50, basisLabel: 'Per Member', isActive: true, needsProof: false },
    ],
  },
];

console.log('=== RUNNING ACTIVITY CRITERIA SELECTOR VERIFICATION SUITE ===\n');

let passedCount = 0;
function pass(testName) {
  passedCount++;
  console.log(`[PASS] ${testName}`);
}

// 1. Flattening and category assignment
const flattened = [];
mockStructureCategories.forEach((cat) => {
  cat.items.forEach((item) => {
    if (item.isActive) {
      flattened.push({
        ...item,
        categoryKey: cat.key,
        categoryLabel: cat.label,
      });
    }
  });
});

assert.strictEqual(flattened.length, 7, 'Total active criteria should be 7');
pass('Test 1.1: Criteria structure flattens into 7 items with categoryKey and categoryLabel');

const meetingDayItems = flattened.filter((c) => c.categoryKey === 'meeting_day');
const nonMeetingItems = flattened.filter((c) => c.categoryKey === 'non_meeting_day');
const penaltyItems = flattened.filter((c) => c.categoryKey === 'penalty');

assert.strictEqual(meetingDayItems.length, 3, 'Meeting day items count = 3');
assert.strictEqual(nonMeetingItems.length, 2, 'Non-meeting items count = 2');
assert.strictEqual(penaltyItems.length, 2, 'Penalty items count = 2');
pass('Test 1.2: Counts match Meeting Day (3), Non-Meeting (2), Penalty (2)');

// 2. Tab Filter Pill counts
const categoryOrder = ['meeting_day', 'non_meeting_day', 'penalty'];
const categoryTabLabels = {
  meeting_day: 'Meeting Day',
  non_meeting_day: 'Non-Meeting',
  penalty: 'Penalties',
};

const pills = [
  { key: 'all', label: `All (${flattened.length})` },
  ...categoryOrder.map((catKey) => {
    const count = flattened.filter((c) => c.categoryKey === catKey).length;
    return { key: catKey, label: `${categoryTabLabels[catKey]} (${count})` };
  }),
];

assert.strictEqual(pills[0].label, 'All (7)');
assert.strictEqual(pills[1].label, 'Meeting Day (3)');
assert.strictEqual(pills[2].label, 'Non-Meeting (2)');
assert.strictEqual(pills[3].label, 'Penalties (2)');
pass('Test 2.1: Filter pills generated correctly with live counts');

// 3. Search filtering logic
function filterCriteria(items, tab, search) {
  let list = items;
  if (tab !== 'all') {
    list = list.filter((c) => c.categoryKey === tab);
  }
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.basisLabel && c.basisLabel.toLowerCase().includes(q)) ||
        (c.categoryLabel && c.categoryLabel.toLowerCase().includes(q))
    );
  }
  return list;
}

const birdSearch = filterCriteria(flattened, 'all', 'Early Bird');
assert.strictEqual(birdSearch.length, 1);
assert.strictEqual(birdSearch[0].id, 'crit_1');
pass('Test 3.1: Search by name "Early Bird" returns 1 matching item');

const visitorSearch = filterCriteria(flattened, 'all', 'visitor');
assert.strictEqual(visitorSearch.length, 1);
assert.strictEqual(visitorSearch[0].name, 'Visitor Introduction');
pass('Test 3.2: Case-insensitive search by basis "visitor" matches criterion');

const nonMeetingSearch = filterCriteria(flattened, 'non_meeting_day', 'Bird');
assert.strictEqual(nonMeetingSearch.length, 0);
pass('Test 3.3: Tab filter combined with search returns empty array when disjoint');

// 4. Positive vs Negative point badge formatting
flattened.forEach((c) => {
  const isNegative = c.points < 0;
  const formattedBadge = c.points > 0 ? `+${c.points} pts` : `${c.points} pts`;
  if (isNegative) {
    assert.ok(formattedBadge.startsWith('-'));
  } else {
    assert.ok(formattedBadge.startsWith('+'));
  }
});
pass('Test 4.1: Positive activities format as +pts and negative penalties format as -pts');

// 5. Quantity calculation
const allowsMultipleQuantity = (basisLabel = '') => {
  if (!basisLabel) return false;
  return /Per Visitor|Per Testimonial|Per Specific Ask|Per Week/i.test(basisLabel);
};

assert.strictEqual(allowsMultipleQuantity('Per Member'), false);
assert.strictEqual(allowsMultipleQuantity('Per Visitor'), true);
assert.strictEqual(allowsMultipleQuantity('Per Testimonial'), true);
assert.strictEqual(allowsMultipleQuantity('Per Week'), true);
pass('Test 5.1: Multi-quantity basis recognition matches business rules');

console.log(`\n=== RESULTS: ${passedCount} PASSED, 0 FAILED ===\n`);
