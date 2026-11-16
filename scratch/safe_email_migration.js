const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:/Users/VIGNESHBABU T G/OneDrive/Documents/DTG/PROJECTS/Management System/Server/.env' });

async function runMigration() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  console.log('Connecting to database...');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB Atlas');

  const usersCollection = mongoose.connection.collection('users');
  const allUsers = await usersCollection.find({}).toArray();

  console.log(`\n=== 1. AUDIT OF EXISTING USERS (${allUsers.length} total) ===`);
  const missingEmailUsers = [];
  const existingEmailUsers = [];
  const emailsSeen = new Set();
  const duplicateEmails = [];

  allUsers.forEach((u, i) => {
    if (!u.email) {
      missingEmailUsers.push({ id: u._id, name: u.name, username: u.username, phone: u.phone, role: u.role });
    } else {
      existingEmailUsers.push({ id: u._id, name: u.name, username: u.username, email: u.email, role: u.role });
      const lower = u.email.toLowerCase().trim();
      if (emailsSeen.has(lower)) {
        duplicateEmails.push(lower);
      }
      emailsSeen.add(lower);
    }
  });

  console.log(`- Accounts with missing email: ${missingEmailUsers.length}`);
  console.log(`- Accounts with existing email: ${existingEmailUsers.length}`);
  console.log(`- Duplicate emails found: ${duplicateEmails.length}`);

  missingEmailUsers.forEach((u) => {
    console.log(`  * [${u.role}] ${u.name} (@${u.username}) - Phone: ${u.phone}`);
  });

  console.log('\n=== 2. MANAGING DATABASE INDEXES ===');
  const indexes = await usersCollection.indexes();
  console.log('Current indexes:', indexes.map(idx => idx.name).join(', '));

  // Check username index
  const usernameIdx = indexes.find(idx => idx.name === 'username_1');
  if (usernameIdx && !usernameIdx.sparse) {
    console.log('Dropping non-sparse username_1 index...');
    await usersCollection.dropIndex('username_1');
    console.log('Recreating username_1 index with { unique: true, sparse: true }...');
    await usersCollection.createIndex({ username: 1 }, { unique: true, sparse: true });
    console.log('username_1 index recreated successfully as sparse.');
  } else {
    console.log('username_1 index is already sparse or does not exist.');
  }

  // Create email index
  const emailIdx = indexes.find(idx => idx.name === 'email_1');
  if (!emailIdx) {
    console.log('Creating email_1 index with { unique: true, sparse: true }...');
    await usersCollection.createIndex({ email: 1 }, { unique: true, sparse: true });
    console.log('email_1 index created successfully.');
  } else {
    console.log('email_1 index already exists.');
  }

  const updatedIndexes = await usersCollection.indexes();
  console.log('\nUpdated indexes on users collection:');
  updatedIndexes.forEach(idx => console.log(' - ' + JSON.stringify(idx)));

  console.log('\n=== 3. MIGRATION AUDIT COMPLETE ===');
  console.log('All existing user records preserved without modification.');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

runMigration().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
