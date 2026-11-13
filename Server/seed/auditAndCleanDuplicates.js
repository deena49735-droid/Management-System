const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Criteria = require('../models/Criteria');
const PointEntry = require('../models/PointEntry');
const TeamPointEntry = require('../models/TeamPointEntry');

const isApplyMode = process.argv.includes('--apply');

async function run() {
  console.log('=====================================================');
  console.log(`KADAMBAS MIGRATION & AUDIT TOOL: ${isApplyMode ? 'APPLY MODE (--apply)' : 'REPORT-ONLY AUDIT MODE'}`);
  console.log('=====================================================');

  if (!process.env.MONGO_URI) {
    console.error('ERROR: MONGO_URI is not set in environment.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB successfully.');

  let hasErrors = false;

  // ----------------------------------------------------
  // 1. Audit PointEntry (Member Ledger)
  // ----------------------------------------------------
  console.log('\n--- 1. Auditing PointEntry Collection ---');
  const pointEntriesTotal = await PointEntry.countDocuments();
  console.log(`Total PointEntry documents: ${pointEntriesTotal}`);

  const pointEntriesMissingFreq = await PointEntry.find({
    $or: [{ frequency: { $exists: false } }, { frequency: null }],
  });
  console.log(`PointEntry documents missing frequency: ${pointEntriesMissingFreq.length}`);

  const pointResolutions = [];
  const orphanedPointEntries = [];

  for (const doc of pointEntriesMissingFreq) {
    if (doc.isAdminAdjustment) {
      pointResolutions.push({ id: doc._id, frequency: 'weekly', note: 'Admin Adjustment' });
      continue;
    }
    const crit = await Criteria.findById(doc.criteria);
    if (!crit || !crit.frequency || !['weekly', 'monthly'].includes(crit.frequency)) {
      orphanedPointEntries.push({
        entryId: doc._id,
        criteriaId: doc.criteria,
        points: doc.points,
        date: doc.date,
        reason: 'Criteria not found or invalid frequency in criteria definition',
      });
    } else {
      pointResolutions.push({ id: doc._id, frequency: crit.frequency });
    }
  }

  if (orphanedPointEntries.length > 0) {
    console.error('\n[FATAL] Orphaned PointEntry records detected! Cannot safely resolve frequency:');
    console.table(orphanedPointEntries);
    hasErrors = true;
  }

  // Check for Member Weekly Duplicates
  const weeklyDuplicates = await PointEntry.aggregate([
    {
      $match: {
        status: { $in: ['pending', 'approved'] },
        isReversal: false,
        isAdminAdjustment: false,
      },
    },
    {
      $group: {
        _id: { member: '$member', criteria: '$criteria', weekNumber: '$weekNumber', year: '$year' },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (weeklyDuplicates.length > 0) {
    console.error(`\n[FATAL] Found ${weeklyDuplicates.length} weekly duplicate group(s) in PointEntry:`);
    console.table(weeklyDuplicates);
    hasErrors = true;
  }

  // Check for Member Monthly Duplicates
  const monthlyDuplicates = await PointEntry.aggregate([
    {
      $match: {
        status: { $in: ['pending', 'approved'] },
        isReversal: false,
        isAdminAdjustment: false,
      },
    },
    {
      $group: {
        _id: { member: '$member', criteria: '$criteria', month: '$month', year: '$year' },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (monthlyDuplicates.length > 0) {
    console.error(`\n[FATAL] Found ${monthlyDuplicates.length} monthly duplicate group(s) in PointEntry:`);
    console.table(monthlyDuplicates);
    hasErrors = true;
  }

  // ----------------------------------------------------
  // 2. Audit TeamPointEntry (Team Ledger)
  // ----------------------------------------------------
  console.log('\n--- 2. Auditing TeamPointEntry Collection ---');
  const teamEntriesTotal = await TeamPointEntry.countDocuments();
  console.log(`Total TeamPointEntry documents: ${teamEntriesTotal}`);

  const teamEntriesMissingFreq = await TeamPointEntry.find({
    $or: [{ frequency: { $exists: false } }, { frequency: null }],
  });
  console.log(`TeamPointEntry documents missing frequency: ${teamEntriesMissingFreq.length}`);

  const teamResolutions = [];
  const orphanedTeamEntries = [];

  for (const doc of teamEntriesMissingFreq) {
    if (doc.isAdminAdjustment) {
      teamResolutions.push({ id: doc._id, frequency: 'monthly', note: 'Admin Adjustment' });
      continue;
    }
    const crit = await Criteria.findById(doc.criteria);
    if (!crit || !crit.frequency || !['monthly', 'one_time'].includes(crit.frequency)) {
      orphanedTeamEntries.push({
        entryId: doc._id,
        criteriaId: doc.criteria,
        points: doc.points,
        reason: 'Criteria not found or invalid frequency in criteria definition',
      });
    } else {
      teamResolutions.push({ id: doc._id, frequency: crit.frequency });
    }
  }

  if (orphanedTeamEntries.length > 0) {
    console.error('\n[FATAL] Orphaned TeamPointEntry records detected! Cannot safely resolve frequency:');
    console.table(orphanedTeamEntries);
    hasErrors = true;
  }

  // Check for Team Monthly Duplicates
  const teamMonthlyDuplicates = await TeamPointEntry.aggregate([
    {
      $match: {
        status: { $in: ['pending', 'approved'] },
        isReversal: false,
        isAdminAdjustment: false,
      },
    },
    {
      $group: {
        _id: { team: '$team', criteria: '$criteria', month: '$month', year: '$year' },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (teamMonthlyDuplicates.length > 0) {
    console.error(`\n[FATAL] Found ${teamMonthlyDuplicates.length} monthly duplicate group(s) in TeamPointEntry:`);
    console.table(teamMonthlyDuplicates);
    hasErrors = true;
  }

  // Check for Team One-Time Duplicates
  const teamOneTimeDuplicates = await TeamPointEntry.aggregate([
    {
      $match: {
        status: { $in: ['pending', 'approved'] },
        isReversal: false,
        isAdminAdjustment: false,
      },
    },
    {
      $group: {
        _id: { team: '$team', criteria: '$criteria' },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (teamOneTimeDuplicates.length > 0) {
    console.error(`\n[FATAL] Found ${teamOneTimeDuplicates.length} one-time duplicate group(s) in TeamPointEntry:`);
    console.table(teamOneTimeDuplicates);
    hasErrors = true;
  }

  // ----------------------------------------------------
  // Summary & Execution
  // ----------------------------------------------------
  if (hasErrors) {
    console.error('\n[ABORTED] Migration cannot proceed due to orphaned records or duplicates.');
    console.error('No historical entries have been altered, deleted, or rejected.');
    console.error('No indexes were created. Please resolve database conflicts before running with --apply.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('\n[AUDIT SUCCESS] 0 orphaned entries and 0 duplicate collisions detected.');

  if (!isApplyMode) {
    console.log('\n[REPORT ONLY] Script completed in report-only mode.');
    console.log('To apply frequency backfill and create partial unique indexes, run with --apply.');
    await mongoose.disconnect();
    return;
  }

  console.log('\n--- 3. Applying Migration & Creating Partial Unique Indexes ---');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Backfill PointEntry frequency
    if (pointResolutions.length > 0) {
      console.log(`Backfilling frequency for ${pointResolutions.length} PointEntry documents...`);
      for (const res of pointResolutions) {
        await PointEntry.updateOne({ _id: res.id }, { $set: { frequency: res.frequency } }, { session });
      }
    }

    // 2. Backfill TeamPointEntry frequency
    if (teamResolutions.length > 0) {
      console.log(`Backfilling frequency for ${teamResolutions.length} TeamPointEntry documents...`);
      for (const res of teamResolutions) {
        await TeamPointEntry.updateOne({ _id: res.id }, { $set: { frequency: res.frequency } }, { session });
      }
    }

    await session.commitTransaction();
    console.log('Database records updated successfully.');
  } catch (err) {
    await session.abortTransaction();
    console.error('Transaction failed during backfill:', err.message);
    throw err;
  } finally {
    session.endSession();
  }

  // 3. Create Explicit Partial Unique Indexes (Never use syncIndexes)
  console.log('Building explicit partial unique indexes on PointEntry...');
  await PointEntry.collection.createIndex(
    { member: 1, criteria: 1, weekNumber: 1, year: 1 },
    {
      name: 'uniq_point_weekly_active',
      unique: true,
      partialFilterExpression: {
        frequency: 'weekly',
        isReversal: false,
        isAdminAdjustment: false,
        status: { $in: ['pending', 'approved'] },
      },
    }
  );

  await PointEntry.collection.createIndex(
    { member: 1, criteria: 1, month: 1, year: 1 },
    {
      name: 'uniq_point_monthly_active',
      unique: true,
      partialFilterExpression: {
        frequency: 'monthly',
        isReversal: false,
        isAdminAdjustment: false,
        status: { $in: ['pending', 'approved'] },
      },
    }
  );

  await PointEntry.collection.createIndex(
    { reversalOf: 1 },
    {
      name: 'uniq_point_reversal',
      unique: true,
      partialFilterExpression: {
        isReversal: true,
      },
    }
  );

  console.log('Building explicit partial unique indexes on TeamPointEntry...');
  await TeamPointEntry.collection.createIndex(
    { team: 1, criteria: 1, month: 1, year: 1 },
    {
      name: 'uniq_teampoint_monthly_active',
      unique: true,
      partialFilterExpression: {
        frequency: 'monthly',
        isReversal: false,
        isAdminAdjustment: false,
        status: { $in: ['pending', 'approved'] },
      },
    }
  );

  await TeamPointEntry.collection.createIndex(
    { team: 1, criteria: 1 },
    {
      name: 'uniq_teampoint_one_time_active',
      unique: true,
      partialFilterExpression: {
        frequency: 'one_time',
        isReversal: false,
        isAdminAdjustment: false,
        status: { $in: ['pending', 'approved'] },
      },
    }
  );

  await TeamPointEntry.collection.createIndex(
    { reversalOf: 1 },
    {
      name: 'uniq_teampoint_reversal',
      unique: true,
      partialFilterExpression: {
        isReversal: true,
      },
    }
  );

  console.log('Verifying created indexes...');
  const pointIndexes = await PointEntry.collection.indexes();
  console.log('PointEntry indexes:', pointIndexes.map((idx) => idx.name).join(', '));

  const teamIndexes = await TeamPointEntry.collection.indexes();
  console.log('TeamPointEntry indexes:', teamIndexes.map((idx) => idx.name).join(', '));

  console.log('\n[SUCCESS] Migration and partial unique index creation completed successfully.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});

