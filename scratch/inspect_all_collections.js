const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:/Users/VIGNESHBABU T G/OneDrive/Documents/DTG/PROJECTS/Management System/Server/.env' });

async function inspectAll() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  console.log('=== DATABASE AUDIT REPORT ===');
  console.log(`Database Name: ${db.databaseName}`);
  console.log(`Found ${collections.length} collections:\n`);

  for (const col of collections) {
    const name = col.name;
    const count = await db.collection(name).countDocuments();
    console.log(`Collection: "${name}" -> ${count} documents`);
  }

  console.log('\n--- Details of Users ---');
  const users = await db.collection('users').find({}).toArray();
  users.forEach((u) => {
    console.log(`User [${u.role}]: Name: "${u.name}", Username: "${u.username}", Email: "${u.email || 'None'}", Phone: "${u.phone}", Team: ${u.team}`);
  });

  console.log('\n--- Details of Teams ---');
  const teams = await db.collection('teams').find({}).toArray();
  teams.forEach((t) => {
    console.log(`Team: "${t.name}" (Active: ${t.isActive}), Head: ${t.head}, Assistant: ${t.assistant}, Members count: ${t.members?.length || 0}`);
  });

  await mongoose.disconnect();
}

inspectAll().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
