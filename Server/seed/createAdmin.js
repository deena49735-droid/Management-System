const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables from server root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const User = require('../models/User');

const createAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ Error: MONGO_URI is not defined in environment variables.');
      process.exit(1);
    }

    const adminName = process.env.ADMIN_NAME || 'Super Admin';
    const adminPhone = process.env.ADMIN_PHONE;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPhone || !adminPassword) {
      console.error(
        '❌ Error: ADMIN_PHONE and ADMIN_PASSWORD must be defined in your .env file to seed the admin user.'
      );
      process.exit(1);
    }

    if (adminPassword.length < 6) {
      console.error('❌ Error: ADMIN_PASSWORD must be at least 6 characters long.');
      process.exit(1);
    }

    // Connect to database
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    // Check if an admin user already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log(
        `ℹ️  An admin user already exists (Name: ${existingAdmin.name}, Phone: ${existingAdmin.phone}). Skipping creation.`
      );
      await mongoose.connection.close();
      process.exit(0);
    }

    // Check if phone number is already registered
    const existingPhone = await User.findOne({ phone: adminPhone });
    if (existingPhone) {
      console.error(
        `❌ Error: A user with phone number "${adminPhone}" already exists with role "${existingPhone.role}".`
      );
      await mongoose.connection.close();
      process.exit(1);
    }

    // Create admin user (password is automatically hashed by the User pre-save hook)
    const admin = await User.create({
      name: adminName,
      phone: adminPhone,
      password: adminPassword,
      role: 'admin',
      isActive: true,
    });

    console.log('========================================');
    console.log('🎉 First admin user created successfully!');
    console.log(`   ID:    ${admin._id}`);
    console.log(`   Name:  ${admin.name}`);
    console.log(`   Phone: ${admin.phone}`);
    console.log(`   Role:  ${admin.role}`);
    console.log('========================================');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin user:', error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

createAdmin();

