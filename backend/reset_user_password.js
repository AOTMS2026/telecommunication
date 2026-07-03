// Run this from backend/ with: node reset_user_password.js
require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const User = require('./src/models/User');

const EMAIL = 'ameenaotms@gmail.com';
const NEW_PASSWORD = 'Ameen@aotms'; // change if you want a different one

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const user = await User.findOne({ email: EMAIL }).select('+password');
  if (!user) {
    console.log(`No user found with email: ${EMAIL}`);
  } else {
    console.log(`Found user: ${user.name} (${user.email}) — isActive: ${user.isActive}`);
    user.password = NEW_PASSWORD; // pre('save') hook will bcrypt-hash it
    user.isActive = true;
    await user.save();
    console.log('Password reset successfully. Try logging in again.');
  }

  await mongoose.disconnect();
}

run().catch(console.error);