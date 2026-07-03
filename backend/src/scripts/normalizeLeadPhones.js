// scripts/normalizeLeadPhones.js
//
// One-off migration: rewrites every existing Lead's phone/alternatePhone to
// the last-10-digits format enforced going forward by the schema setter in
// models/Lead.js. Safe to re-run — already-normalized numbers are skipped.
//
// Usage:
//   cd backend
//   node src/scripts/normalizeLeadPhones.js
//
// Reads MONGODB_URI / MONGO_URI from backend/.env just like the server does.

require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { normalizePhone10 } = require('../utils/phone');

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('No MONGODB_URI/MONGO_URI set in backend/.env — aborting.');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`Connected: ${mongoose.connection.host}`);

  const leads = await Lead.find({}).select('_id phone alternatePhone').lean();
  console.log(`Scanning ${leads.length} leads...`);

  let updated = 0;
  let skipped = 0;

  for (const lead of leads) {
    const newPhone = normalizePhone10(lead.phone);
    const newAlt = normalizePhone10(lead.alternatePhone);

    const phoneChanged = newPhone !== (lead.phone || '');
    const altChanged = newAlt !== (lead.alternatePhone || '');

    if (!phoneChanged && !altChanged) { skipped++; continue; }

    // Bypass the schema setter re-normalizing what we already normalized —
    // updateOne with $set on raw strings is fine here since the values are
    // already in final form.
    await Lead.updateOne({ _id: lead._id }, { $set: { phone: newPhone, alternatePhone: newAlt } });
    updated++;
  }

  console.log(`Done. Updated ${updated} leads, ${skipped} already normalized.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});