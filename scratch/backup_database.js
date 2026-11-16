const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:/Users/VIGNESHBABU T G/OneDrive/Documents/DTG/PROJECTS/Management System/Server/.env' });

async function backupDatabase() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  console.log('Connecting to MongoDB for backup...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const backupDir = path.join(__dirname, 'backups', `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`Backup target directory: ${backupDir}`);

  const collections = await db.listCollections().toArray();
  const summary = {};

  for (const col of collections) {
    const name = col.name;
    const records = await db.collection(name).find({}).toArray();
    summary[name] = records.length;
    const filePath = path.join(backupDir, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf-8');
    console.log(`Backed up "${name}": ${records.length} documents -> ${filePath}`);
  }

  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    database: db.databaseName,
    summary,
  }, null, 2), 'utf-8');

  console.log('\nBackup completed successfully!');
  await mongoose.disconnect();
  return backupDir;
}

if (require.main === module) {
  backupDatabase().catch((err) => {
    console.error('Backup failed:', err);
    process.exit(1);
  });
}

module.exports = { backupDatabase };
