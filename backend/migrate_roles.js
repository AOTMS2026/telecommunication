/**
 * Run ONCE on your server: node migrate_roles.js
 * 'super admin' → 'admin'
 * 'admin'       → 'manager'
 * 'caller'      unchanged
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const col = db.collection('users');

  // Step 1: mark old admins with a temp flag so step 2 doesn't touch super admins
  await col.updateMany({ role: 'admin' }, { $set: { _oldAdmin: true } });

  // Step 2: super admin → admin
  const r1 = await col.updateMany({ role: 'super admin' }, { $set: { role: 'admin' } });
  console.log(`super admin → admin: ${r1.modifiedCount}`);

  // Step 3: old admin (flagged) → manager
  const r2 = await col.updateMany({ _oldAdmin: true }, { $set: { role: 'manager' }, $unset: { _oldAdmin: '' } });
  console.log(`admin → manager: ${r2.modifiedCount}`);

  // Cleanup temp flag if any remain
  await col.updateMany({ _oldAdmin: { $exists: true } }, { $unset: { _oldAdmin: '' } });

  console.log('Migration complete.');
  await mongoose.disconnect();
}

migrate().catch(e => { console.error(e); process.exit(1); });