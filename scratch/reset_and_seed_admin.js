const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config({ path: 'c:/Users/VIGNESHBABU T G/OneDrive/Documents/DTG/PROJECTS/Management System/Server/.env' });

const { backupDatabase } = require('./backup_database');

async function resetAndSeedAdmin() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'Super Admin';
  const adminPhone = process.env.ADMIN_PHONE || '9876543210';
  const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured in Server/.env');
  }

  console.log('=== STEP 1: BACKING UP DATABASE ===');
  const backupDir = await backupDatabase();
  console.log(`Verified backup saved at: ${backupDir}\n`);

  console.log('=== STEP 2: CONNECTING TO MONGODB ===');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');

  console.log('=== STEP 3: SEEDING / INITIALIZING FRESH ADMIN ACCOUNT ===');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(adminPassword, salt);

  // Check if admin with this email exists
  let adminUser = await usersCollection.findOne({ email: adminEmail });

  if (adminUser) {
    console.log(`Existing user found with email "${adminEmail}". Updating to clean Admin profile...`);
    await usersCollection.updateOne(
      { _id: adminUser._id },
      {
        $set: {
          name: adminName,
          email: adminEmail,
          username: adminUsername,
          phone: adminPhone,
          password: hashedPassword,
          role: 'admin',
          team: null,
          isActive: true,
          updatedAt: new Date(),
        },
      }
    );
    adminUser = await usersCollection.findOne({ _id: adminUser._id });
  } else {
    // Check if there is an existing admin with role 'admin'
    const legacyAdmin = await usersCollection.findOne({ role: 'admin' });
    if (legacyAdmin && !legacyAdmin.email) {
      console.log(`Updating legacy admin (@${legacyAdmin.username}) with email "${adminEmail}"...`);
      await usersCollection.updateOne(
        { _id: legacyAdmin._id },
        {
          $set: {
            name: adminName,
            email: adminEmail,
            username: adminUsername,
            phone: adminPhone,
            password: hashedPassword,
            role: 'admin',
            team: null,
            isActive: true,
            updatedAt: new Date(),
          },
        }
      );
      adminUser = await usersCollection.findOne({ _id: legacyAdmin._id });
    } else {
      console.log(`Creating fresh admin user for "${adminEmail}"...`);
      const insertResult = await usersCollection.insertOne({
        name: adminName,
        email: adminEmail,
        username: adminUsername,
        phone: adminPhone,
        password: hashedPassword,
        role: 'admin',
        team: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      adminUser = await usersCollection.findOne({ _id: insertResult.insertedId });
    }
  }

  console.log(`Admin account confirmed: ID: ${adminUser._id}, Email: ${adminUser.email}, Role: ${adminUser.role}`);

  // Verify password hash
  const isMatch = await bcrypt.compare(adminPassword, adminUser.password);
  if (!isMatch) {
    throw new Error('Verification failed: newly hashed admin password does not match candidate password!');
  }
  console.log('✅ Admin credentials verification passed.\n');

  console.log('=== STEP 4: FRESH DATABASE CLEANUP ===');
  // 1. Remove all other users except the verified fresh admin
  const deleteUsersResult = await usersCollection.deleteMany({ _id: { $ne: adminUser._id } });
  console.log(`- Deleted non-admin users: ${deleteUsersResult.deletedCount}`);

  // 2. Remove all teams
  const deleteTeamsResult = await db.collection('teams').deleteMany({});
  console.log(`- Deleted teams: ${deleteTeamsResult.deletedCount}`);

  // 3. Remove all point entries
  const deletePointsResult = await db.collection('pointentries').deleteMany({});
  console.log(`- Deleted member point entries: ${deletePointsResult.deletedCount}`);

  // 4. Remove all team point entries
  const deleteTeamPointsResult = await db.collection('teampointentries').deleteMany({});
  console.log(`- Deleted team point entries: ${deleteTeamPointsResult.deletedCount}`);

  // 5. Remove all meetings
  const deleteMeetingsResult = await db.collection('meetings').deleteMany({});
  console.log(`- Deleted meetings: ${deleteMeetingsResult.deletedCount}`);

  // 6. Remove all audit logs
  const deleteAuditResult = await db.collection('auditlogs').deleteMany({});
  console.log(`- Deleted audit logs: ${deleteAuditResult.deletedCount}`);

  console.log('\n=== STEP 5: VERIFYING PRESERVED DATA & FINAL COUNTS ===');
  const criteriaCount = await db.collection('criterias').countDocuments();
  console.log(`- Preserved official game criteria: ${criteriaCount} (Expected: 45)`);

  const remainingUsers = await usersCollection.find({}).toArray();
  console.log(`- Remaining users: ${remainingUsers.length} (Expected: 1)`);
  remainingUsers.forEach((u) => {
    console.log(`  * User: "${u.name}" (${u.email || u.username}) | Role: ${u.role} | Team: ${u.team}`);
  });

  const remainingTeams = await db.collection('teams').countDocuments();
  console.log(`- Remaining teams: ${remainingTeams} (Expected: 0)`);

  const remainingPoints = await db.collection('pointentries').countDocuments();
  console.log(`- Remaining point entries: ${remainingPoints} (Expected: 0)`);

  await mongoose.disconnect();
  console.log('\n✅ Cleanup and Admin seeding complete.');
}

if (require.main === module) {
  resetAndSeedAdmin().catch((err) => {
    console.error('Operation failed:', err);
    process.exit(1);
  });
}

module.exports = { resetAndSeedAdmin };
