const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('../models/User');
const Team = require('../models/Team');

dotenv.config();

const migrateTeamHead = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI is not set in environment variables.');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    // 1. Update all users with role "teamLead" to "teamHead"
    const userResult = await User.updateMany(
      { role: 'teamLead' },
      { $set: { role: 'teamHead' } }
    );
    console.log(`Users updated from "teamLead" to "teamHead": ${userResult.modifiedCount}`);

    // 2. Rename the field "lead" to "head" on all Team documents
    const teamResult = await Team.updateMany(
      { lead: { $exists: true } },
      { $rename: { lead: 'head' } }
    );
    console.log(`Teams updated with field "lead" renamed to "head": ${teamResult.modifiedCount}`);

    console.log('Migration to Team Head completed successfully.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

migrateTeamHead();

