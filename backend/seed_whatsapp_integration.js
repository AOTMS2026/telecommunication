/**
 * AOTMS – Activate WhatsApp Cloud API Integration
 *
 * Reads WhatsApp credentials from backend/.env (never hardcode secrets in
 * this file) and creates/updates the Integration document so the
 * Broadcasts feature can send messages immediately, without going through
 * the UI wizard.
 *
 * 1. Add these lines to backend/.env (fill in your real values there,
 *    not in this file):
 *
 *      WHATSAPP_ACCESS_TOKEN=your_permanent_or_temp_token
 *      WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
 *      WHATSAPP_WABA_ID=your_waba_id
 *      WHATSAPP_VERIFY_TOKEN=any_random_string_you_choose   (already in .env)
 *
 * 2. Run (from the backend/ folder):
 *      node seed_whatsapp_integration.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const Integration = require('./src/models/Integration');

const run = async () => {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const wabaId = process.env.WHATSAPP_WABA_ID;
  const webhookVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'aotms_wa_verify';

  if (!accessToken || !phoneNumberId || !wabaId) {
    console.error('❌ Missing one of WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_WABA_ID in backend/.env');
    process.exit(1);
  }

  await connectDB();

  const existing = await Integration.findOne({ type: 'whatsapp_cloud' });

  if (existing) {
    existing.status = 'active';
    existing.config = {
      ...existing.config,
      accessToken,
      phoneNumberId,
      wabaId,
      webhookVerifyToken,
    };
    await existing.save();
    console.log(`✅ Updated existing Whatsapp Cloud API integration (${existing._id}) and set status: active`);
  } else {
    const crypto = require('crypto');
    const created = await Integration.create({
      type: 'whatsapp_cloud',
      name: 'Whatsapp Cloud API',
      description: 'Receive & send WhatsApp messages via Meta Cloud API',
      status: 'active',
      webhookKey: crypto.randomBytes(24).toString('hex'),
      config: { accessToken, phoneNumberId, wabaId, webhookVerifyToken },
    });
    console.log(`✅ Created Whatsapp Cloud API integration (${created._id}) with status: active`);
  }

  console.log('\nGo to WhatsApp → Broadcasts in the app — the "No active WhatsApp integration" error should be gone.');
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});