const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
    const adminPhone = (process.env.ADMIN_PHONE || '9876543210').trim();
    const adminPassword = (process.env.ADMIN_PASSWORD || '').trim();

    if (!adminEmail || !adminPassword) {
      console.error(
        '❌ Error: ADMIN_EMAIL and ADMIN_PASSWORD must be defined in your .env file to seed the admin user.'
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

    // Check if an admin user already exists with this email or role
    const existingAdminByEmail = await User.findOne({ email: adminEmail });
    if (existingAdminByEmail) {
      console.log(
        `ℹ️  An admin user with email "${adminEmail}" already exists (Name: ${existingAdminByEmail.name}, Phone: ${existingAdminByEmail.phone}). Updating credentials and role...`
      );
      existingAdminByEmail.name = adminName;
      existingAdminByEmail.username = adminUsername;
      existingAdminByEmail.phone = adminPhone;
      existingAdminByEmail.password = adminPassword; // Will be hashed by pre('save') hook
      existingAdminByEmail.role = 'admin';
      existingAdminByEmail.team = null;
      existingAdminByEmail.isActive = true;
      await existingAdminByEmail.save();

      console.log('✅ Admin credentials updated successfully.');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Check if a legacy admin user exists without email
    const legacyAdmin = await User.findOne({ role: 'admin' });
    if (legacyAdmin && !legacyAdmin.email) {
      console.log(`ℹ️  Found legacy admin (@${legacyAdmin.username}). Updating to email-based admin (${adminEmail})...`);
      legacyAdmin.email = adminEmail;
      legacyAdmin.name = adminName;
      legacyAdmin.username = adminUsername;
      legacyAdmin.phone = adminPhone;
      legacyAdmin.password = adminPassword;
      legacyAdmin.team = null;
      legacyAdmin.isActive = true;
      await legacyAdmin.save();

      console.log('✅ Legacy admin migrated to email login successfully.');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Create fresh admin user (password is automatically hashed by the User pre-save hook)
    const admin = await User.create({
      name: adminName,
      email: adminEmail,
      username: adminUsername,
      phone: adminPhone,
      password: adminPassword,
      role: 'admin',
      team: null,
      isActive: true,
    });

    console.log('========================================');
    console.log('🎉 First admin user created successfully!');
    console.log(`   ID:       ${admin._id}`);
    console.log(`   Name:     ${admin.name}`);
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Username: ${admin.username}`);
    console.log(`   Phone:    ${admin.phone}`);
    console.log(`   Role:     ${admin.role}`);
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

