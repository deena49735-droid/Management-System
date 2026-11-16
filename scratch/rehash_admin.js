const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:/Users/VIGNESHBABU T G/OneDrive/Documents/DTG/PROJECTS/Management System/Server/.env' });

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);
  const rawPwd = (process.env.ADMIN_PASSWORD || '').trim();
  const rawPhone = (process.env.ADMIN_PHONE || '9876543234').trim();
  const rawEmail = (process.env.ADMIN_EMAIL || 'admin@gmail.com').trim().toLowerCase();
  const rawName = (process.env.ADMIN_NAME || 'Admin').trim();

  console.log('Seeding with:', { email: rawEmail, phone: rawPhone, passwordLength: rawPwd.length });
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(rawPwd, salt);

  const res = await mongoose.connection.db.collection('users').updateOne(
    { role: 'admin' },
    {
      $set: {
        name: rawName,
        email: rawEmail,
        phone: rawPhone,
        password: hashed,
        role: 'admin',
        team: null,
        isActive: true,
        updatedAt: new Date(),
      },
    }
  );

  console.log('Update result:', res);
  const updatedAdmin = await mongoose.connection.db.collection('users').findOne({ role: 'admin' });
  console.log('Updated Admin in DB:', { id: updatedAdmin._id, email: updatedAdmin.email, phone: updatedAdmin.phone });
  const compareResult = await bcrypt.compare(rawPwd, updatedAdmin.password);
  console.log('bcrypt.compare result with .env password:', compareResult);
  await mongoose.disconnect();
})();
