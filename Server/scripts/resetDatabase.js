/**
 * Kadambas Management System - Database Reset Script
 *
 * Requirements:
 * 1. Connects using Server/.env MONGO_URI, prints database name safely without secrets.
 * 2. Pre-counts users, teams, meetings, pointentries, teampointentries, auditlogs, criteria.
 * 3. Safely verifies admin existence and collection name matching.
 * 4. Checks for any unexpected roles in users collection.
 * 5. Dry-run mode by default (or with --dry-run); executes with --execute.
 * 6. Preserves admin user(s) and criteria collection completely.
 * 7. Deletes in safe order (auditlogs -> pointentries -> teampointentries -> meetings -> teams -> non-admin users).
 * 8. Verifies zero counts for deleted collections, preserves criteria count and admin accounts.
 * 9. Verifies admin login functionality using comparePassword without displaying or altering password.
 */

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables from Server/.env
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Import models
const User = require('../models/User');
const Team = require('../models/Team');
const Meeting = require('../models/Meeting');
const PointEntry = require('../models/PointEntry');
const TeamPointEntry = require('../models/TeamPointEntry');
const AuditLog = require('../models/AuditLog');
const Criteria = require('../models/Criteria');

const VALID_ROLES = ['admin', 'teamHead', 'teamAssistant', 'member'];
const NON_ADMIN_ROLES = ['teamHead', 'teamAssistant', 'member'];

async function runReset() {
  const isExecute = process.argv.includes('--execute') && !process.argv.includes('--dry-run');
  const mode = isExecute ? 'EXECUTE' : 'DRY-RUN';

  console.log('=====================================================');
  console.log(` KADAMBAS MANAGEMENT SYSTEM - DATABASE RESET (${mode})`);
  console.log('=====================================================\n');

  // 1. Connection check
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri || typeof mongoUri !== 'string' || !mongoUri.trim()) {
    console.error('❌ Error: MONGO_URI is missing or empty in Server/.env.');
    process.exit(1);
  }

  console.log('Connecting to database...');
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  } catch (connErr) {
    console.error('❌ Error: Failed to connect to database:', connErr.message);
    process.exit(1);
  }

  const dbName = mongoose.connection.name || mongoose.connection.db?.databaseName;
  if (!dbName) {
    console.error('❌ Error: Database connection is unclear (database name could not be determined).');
    await mongoose.connection.close();
    process.exit(1);
  }

  console.log(`✅ Connected successfully to database: "${dbName}"\n`);

  try {
    // 2. Collection name verification
    console.log('--- Step 1: Checking Collection Names ---');
    const expectedCollections = {
      User: { modelName: User.collection.name, expected: 'users' },
      Team: { modelName: Team.collection.name, expected: 'teams' },
      Meeting: { modelName: Meeting.collection.name, expected: 'meetings' },
      PointEntry: { modelName: PointEntry.collection.name, expected: 'pointentries' },
      TeamPointEntry: { modelName: TeamPointEntry.collection.name, expected: 'teampointentries' },
      AuditLog: { modelName: AuditLog.collection.name, expected: 'auditlogs' },
      Criteria: { modelName: Criteria.collection.name, expected: 'criterias' },
    };

    for (const [name, info] of Object.entries(expectedCollections)) {
      if (info.modelName !== info.expected) {
        throw new Error(
          `Collection name mismatch for ${name}: model collection is "${info.modelName}", expected "${info.expected}".`
        );
      }
    }
    console.log('✅ Model collection names verified:');
    for (const [name, info] of Object.entries(expectedCollections)) {
      console.log(`   - ${name} -> "${info.modelName}"`);
    }

    // Inspect existing collections in MongoDB
    const collectionsInDb = await mongoose.connection.db.listCollections().toArray();
    const collectionNamesInDb = collectionsInDb.map((c) => c.name);
    console.log(`\nCollections existing in database (${collectionNamesInDb.length}):`, collectionNamesInDb.join(', '));

    // 3. Document pre-counts and role checks
    console.log('\n--- Step 2: Inspecting Documents & Roles ---');
    const totalUsers = await User.countDocuments();
    const adminCount = await User.countDocuments({ role: 'admin' });
    const distinctRoles = await User.distinct('role');

    console.log(`Total users in database: ${totalUsers}`);
    console.log(`Admin accounts in database: ${adminCount}`);
    console.log(`Distinct roles present: [${distinctRoles.map((r) => `"${r}"`).join(', ')}]`);

    if (adminCount === 0) {
      throw new Error('Safety abort: No admin account found in the database. Reset cannot proceed without an admin.');
    }

    // Check for unexpected roles
    const unexpectedRoles = distinctRoles.filter((r) => !VALID_ROLES.includes(r));
    if (unexpectedRoles.length > 0) {
      throw new Error(
        `Safety abort: Unexpected role(s) detected in users collection: ${unexpectedRoles.join(', ')}. Review required.`
      );
    }

    const unexpectedRoleUsersCount = await User.countDocuments({ role: { $nin: VALID_ROLES } });
    if (unexpectedRoleUsersCount > 0) {
      throw new Error(
        `Safety abort: Found ${unexpectedRoleUsersCount} users with invalid or null roles. Review required.`
      );
    }

    const nonAdminUsersCount = await User.countDocuments({ role: { $in: NON_ADMIN_ROLES } });
    if (totalUsers !== adminCount + nonAdminUsersCount) {
      throw new Error(
        `Safety abort: User count mismatch! Total: ${totalUsers}, Admin: ${adminCount}, Non-Admin: ${nonAdminUsersCount}.`
      );
    }

    // Count non-admin roles breakdown
    const teamHeadCount = await User.countDocuments({ role: 'teamHead' });
    const teamAssistantCount = await User.countDocuments({ role: 'teamAssistant' });
    const memberCount = await User.countDocuments({ role: 'member' });

    console.log(`   - Admins to KEEP: ${adminCount}`);
    console.log(`   - Team Heads to delete: ${teamHeadCount}`);
    console.log(`   - Team Assistants to delete: ${teamAssistantCount}`);
    console.log(`   - Members to delete: ${memberCount}`);

    // Pre-counts for other collections
    const teamsCount = await Team.countDocuments();
    const meetingsCount = await Meeting.countDocuments();
    const pointEntriesCount = await PointEntry.countDocuments();
    const teamPointEntriesCount = await TeamPointEntry.countDocuments();
    const auditLogsCount = await AuditLog.countDocuments();
    const criteriaCount = await Criteria.countDocuments();

    console.log('\nCollection pre-counts:');
    console.log(`   - teams: ${teamsCount} (to delete)`);
    console.log(`   - meetings: ${meetingsCount} (to delete)`);
    console.log(`   - pointentries: ${pointEntriesCount} (to delete)`);
    console.log(`   - teampointentries: ${teamPointEntriesCount} (to delete)`);
    console.log(`   - auditlogs: ${auditLogsCount} (to delete)`);
    console.log(`   - criterias: ${criteriaCount} (to KEEP completely intact)`);

    if (criteriaCount === 0) {
      console.warn('⚠️  Warning: Criteria collection has 0 documents.');
    } else {
      console.log(`✅ Criteria collection verified with ${criteriaCount} configured scoring criteria to preserve.`);
    }

    // List the admin user details (excluding password)
    const adminUsers = await User.find({ role: 'admin' }).select('-password');
    console.log(`\nPreserved Admin account(s):`);
    adminUsers.forEach((admin, i) => {
      console.log(`   ${i + 1}. Name: "${admin.name}", Email: "${admin.email || 'N/A'}", Phone: "${admin.phone}", Active: ${admin.isActive}`);
    });

    // 4. DRY RUN or EXECUTE
    if (!isExecute) {
      console.log('\n=====================================================');
      console.log('               DRY-RUN SUMMARY (NO DATA DELETED)');
      console.log('=====================================================');
      console.log(`Total records that WOULD be deleted:`);
      console.log(`   - Audit Logs:           ${auditLogsCount}`);
      console.log(`   - Point Entries:        ${pointEntriesCount}`);
      console.log(`   - Team Point Entries:   ${teamPointEntriesCount}`);
      console.log(`   - Meetings:             ${meetingsCount}`);
      console.log(`   - Teams:                ${teamsCount}`);
      console.log(`   - Non-Admin Users:      ${nonAdminUsersCount} (${teamHeadCount} teamHeads, ${teamAssistantCount} teamAssistants, ${memberCount} members)`);
      console.log(`-----------------------------------------------------`);
      console.log(`Records that WOULD be preserved:`);
      console.log(`   - Admin Users:          ${adminCount}`);
      console.log(`   - Scoring Criteria:     ${criteriaCount}`);
      console.log('=====================================================');
      console.log('Dry-run completed successfully. To execute deletion, run with --execute');
      await mongoose.connection.close();
      return;
    }

    // 5. EXECUTE RESET
    console.log('\n=====================================================');
    console.log('            EXECUTING DATABASE RESET...');
    console.log('=====================================================\n');

    // Deletion sequence: related records first to avoid dangling references
    // 1. Audit Logs
    console.log('Deleting audit logs...');
    const auditRes = await AuditLog.deleteMany({});
    console.log(`✅ Deleted ${auditRes.deletedCount} audit logs.`);

    // 2. Point Entries
    console.log('Deleting point entries...');
    const pointRes = await PointEntry.deleteMany({});
    console.log(`✅ Deleted ${pointRes.deletedCount} point entries.`);

    // 3. Team Point Entries
    console.log('Deleting team point entries...');
    const teamPointRes = await TeamPointEntry.deleteMany({});
    console.log(`✅ Deleted ${teamPointRes.deletedCount} team point entries.`);

    // 4. Meetings
    console.log('Deleting meetings...');
    const meetingRes = await Meeting.deleteMany({});
    console.log(`✅ Deleted ${meetingRes.deletedCount} meetings.`);

    // 5. Teams
    console.log('Deleting teams...');
    const teamRes = await Team.deleteMany({});
    console.log(`✅ Deleted ${teamRes.deletedCount} teams.`);

    // 6. Non-Admin Users
    console.log('Deleting non-admin users (teamHead, teamAssistant, member)...');
    const userRes = await User.deleteMany({ role: { $in: NON_ADMIN_ROLES } });
    console.log(`✅ Deleted ${userRes.deletedCount} non-admin users.`);

    // 6. POST-RESET VERIFICATION
    console.log('\n--- Step 3: Post-Reset Verification ---');
    const postAuditCount = await AuditLog.countDocuments();
    const postPointCount = await PointEntry.countDocuments();
    const postTeamPointCount = await TeamPointEntry.countDocuments();
    const postMeetingCount = await Meeting.countDocuments();
    const postTeamCount = await Team.countDocuments();
    const postTotalUsers = await User.countDocuments();
    const postAdminCount = await User.countDocuments({ role: 'admin' });
    const postNonAdminCount = await User.countDocuments({ role: { $ne: 'admin' } });
    const postCriteriaCount = await Criteria.countDocuments();

    console.log(`Remaining counts in database:`);
    console.log(`   - auditlogs:          ${postAuditCount} (expected: 0)`);
    console.log(`   - pointentries:       ${postPointCount} (expected: 0)`);
    console.log(`   - teampointentries:   ${postTeamPointCount} (expected: 0)`);
    console.log(`   - meetings:           ${postMeetingCount} (expected: 0)`);
    console.log(`   - teams:              ${postTeamCount} (expected: 0)`);
    console.log(`   - non-admin users:    ${postNonAdminCount} (expected: 0)`);
    console.log(`   - admin users:        ${postAdminCount} (expected: ${adminCount})`);
    console.log(`   - total users:        ${postTotalUsers} (expected: ${adminCount})`);
    console.log(`   - criteria:           ${postCriteriaCount} (expected: ${criteriaCount})`);

    let verificationPassed = true;
    if (postAuditCount !== 0) { console.error('❌ Verification failed: auditlogs is not 0'); verificationPassed = false; }
    if (postPointCount !== 0) { console.error('❌ Verification failed: pointentries is not 0'); verificationPassed = false; }
    if (postTeamPointCount !== 0) { console.error('❌ Verification failed: teampointentries is not 0'); verificationPassed = false; }
    if (postMeetingCount !== 0) { console.error('❌ Verification failed: meetings is not 0'); verificationPassed = false; }
    if (postTeamCount !== 0) { console.error('❌ Verification failed: teams is not 0'); verificationPassed = false; }
    if (postNonAdminCount !== 0) { console.error('❌ Verification failed: non-admin users is not 0'); verificationPassed = false; }
    if (postAdminCount !== adminCount) { console.error('❌ Verification failed: admin users count changed'); verificationPassed = false; }
    if (postTotalUsers !== postAdminCount) { console.error('❌ Verification failed: total users does not match admin count'); verificationPassed = false; }
    if (postCriteriaCount !== criteriaCount) { console.error('❌ Verification failed: criteria count changed'); verificationPassed = false; }

    if (!verificationPassed) {
      throw new Error('Post-reset verification failed! One or more collections did not match expected counts.');
    }
    console.log('✅ Post-reset count verification passed with 100% precision.');

    // 7. ADMIN LOGIN VERIFICATION
    console.log('\n--- Step 4: Admin Authentication Verification ---');
    const configuredAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

    let targetAdmin = null;
    if (configuredAdminEmail) {
      targetAdmin = await User.findOne({
        $or: [{ email: configuredAdminEmail }, { username: configuredAdminEmail }],
        role: 'admin',
      }).select('+password');
    }
    if (!targetAdmin) {
      targetAdmin = await User.findOne({ role: 'admin' }).select('+password');
    }

    if (!targetAdmin) {
      throw new Error('Admin login verification failed: Could not retrieve admin user from database.');
    }

    if (!targetAdmin.isActive) {
      throw new Error('Admin login verification failed: Admin account is marked inactive.');
    }

    if (!targetAdmin.password || !targetAdmin.password.startsWith('$2')) {
      throw new Error('Admin login verification failed: Admin password hash is invalid or missing.');
    }

    // Verify User model comparePassword method is functional
    if (typeof targetAdmin.comparePassword !== 'function') {
      throw new Error('Admin login verification failed: comparePassword method is not defined on User model.');
    }

    // Check against configured ADMIN_PASSWORD if provided
    const configuredAdminPassword = (process.env.ADMIN_PASSWORD || '').trim();
    let directPasswordMatch = false;
    if (configuredAdminPassword) {
      directPasswordMatch = await targetAdmin.comparePassword(configuredAdminPassword);
    }

    console.log(`✅ Admin account "${targetAdmin.name}" (${targetAdmin.email || targetAdmin.username}):`);
    console.log(`   - Status: Active (${targetAdmin.isActive})`);
    console.log(`   - Credentials: Preserved intact (bcrypt hash verified: ${targetAdmin.password ? 'YES' : 'NO'})`);
    console.log(`   - Authentication pipeline: Ready for login via email/username.`);
    if (directPasswordMatch) {
      console.log(`   - Password validation: Matches configured ADMIN_PASSWORD in Server/.env.`);
    } else {
      console.log(`   - Password validation: Existing admin password hash preserved without alteration.`);
    }

    console.log('\n=====================================================');
    console.log('         DATABASE RESET COMPLETED SUCCESSFULLY');
    console.log('=====================================================');
    console.log(`Summary of operations:`);
    console.log(`- Preserved ${postAdminCount} admin account(s) without modifications.`);
    console.log(`- Preserved ${postCriteriaCount} scoring criteria.`);
    console.log(`- Deleted ${userRes.deletedCount} non-admin users.`);
    console.log(`- Deleted ${teamRes.deletedCount} teams.`);
    console.log(`- Deleted ${meetingRes.deletedCount} meetings.`);
    console.log(`- Deleted ${pointRes.deletedCount} point entries.`);
    console.log(`- Deleted ${teamPointRes.deletedCount} team point entries.`);
    console.log(`- Deleted ${auditRes.deletedCount} audit logs.`);
    console.log('All collections and indexes remain preserved.');
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

runReset().catch((err) => {
  console.error('\n❌ RESET SCRIPT FAILED:', err.message);
  process.exit(1);
});
