const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables from server root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const User = require('../models/User');

const migrateUsernames = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI is not defined in environment variables.');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. Fetch all existing users
    const allUsers = await User.find({}).sort({ role: 1, createdAt: 1 });

    // Track all assigned usernames
    const takenUsernames = new Set();
    allUsers.forEach((u) => {
      if (u.username) {
        takenUsernames.add(u.username.toLowerCase());
      }
    });

    const adminUsernameFromEnv = (process.env.ADMIN_USERNAME || 'admin')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._]/g, '');

    let updatedCount = 0;

    // Helper to generate a clean, valid username
    const generateUniqueUsername = (name, role) => {
      // If admin and ADMIN_USERNAME is available and not yet taken
      if (role === 'admin' && adminUsernameFromEnv && !takenUsernames.has(adminUsernameFromEnv)) {
        return adminUsernameFromEnv;
      }

      // Lowercase, remove spaces and symbols (only keep a-z, 0-9, dot, underscore)
      let base = (name || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9._]/g, '');

      // If fewer than 3 characters, use "user" + number
      if (base.length < 3) {
        let count = 1;
        while (takenUsernames.has(`user${count}`)) {
          count++;
        }
        return `user${count}`;
      }

      // If base is available
      if (!takenUsernames.has(base)) {
        return base;
      }

      // If it already exists, append a number starting from 2 (e.g. ravikumar2)
      let counter = 2;
      while (takenUsernames.has(`${base}${counter}`)) {
        counter++;
      }
      return `${base}${counter}`;
    };

    // 2. Assign usernames to users without one
    for (const user of allUsers) {
      if (!user.username || user.username.trim() === '') {
        const username = generateUniqueUsername(user.name, user.role);
        takenUsernames.add(username);
        await User.collection.updateOne({ _id: user._id }, { $set: { username } });
        user.username = username;
        updatedCount++;
      }
    }

    console.log(`Updated ${updatedCount} user(s) with new usernames.`);

    // 3. Ensure the unique index exists on username
    try {
      await User.collection.createIndex({ username: 1 }, { unique: true });
      console.log('Unique index on username verified/created.');
    } catch (indexError) {
      console.warn('Index note:', indexError.message);
    }

    // 4. Fetch fresh user list and print a table of name -> username -> role
    const finalUsers = await User.find({}).sort({ role: 1, name: 1 });
    const tableData = finalUsers.map((u) => ({
      Name: u.name,
      Username: u.username,
      Role: u.role,
    }));

    console.log('\n--- User Account Credentials Summary ---');
    console.table(tableData);

    await mongoose.connection.close();
    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

migrateUsernames();
