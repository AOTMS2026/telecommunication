const mongoose = require('mongoose');
const dns = require('dns');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Fix for "querySrv ECONNREFUSED" on Windows — default OS DNS resolver
// often fails to resolve mongodb+srv SRV records. Force Google DNS.
dns.setServers(['8.8.8.8', '8.8.4.4']);

let memoryServer;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (uri) {
      try {
        const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
      } catch (primaryErr) {
        console.warn(`Primary MongoDB connection failed: ${primaryErr.message}. Falling back to local MongoDB memory server.`);
        await connectToMemoryServer();
      }
    } else {
      await connectToMemoryServer();
    }

    await syncBlockedLeads();
    return mongoose.connection;
  } catch (error) {
    console.error(`MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

async function connectToMemoryServer() {
  if (memoryServer) {
    const conn = await mongoose.connect(memoryServer.getUri(), { serverSelectionTimeoutMS: 10000 });
    console.log(`MongoDB Connected (memory): ${conn.connection.host}`);
    return;
  }

  memoryServer = await MongoMemoryServer.create({
    binary: { version: '7.0.14' },
    instance: { dbName: process.env.DB_NAME || 'aotms' },
  });

  const conn = await mongoose.connect(memoryServer.getUri(), { serverSelectionTimeoutMS: 10000 });
  console.log(`MongoDB Connected (memory): ${conn.connection.host}`);
}

async function syncBlockedLeads() {
  try {
    const Lead = require('../models/Lead');
    const Blocklist = require('../models/Blocklist');

    const blockedLeads = await Lead.find({ status: 'Blocked' });
    if (blockedLeads.length > 0) {
      console.log(`[DB SYNC] Found ${blockedLeads.length} leads with Blocked status. Verifying blocklist...`);
      for (const lead of blockedLeads) {
        const cleanPhone = String(lead.phone || '').replace(/\D/g, '');
        const isBlocked = await Blocklist.findOne({ phone: cleanPhone });
        if (!isBlocked) {
          console.log(`[DB SYNC] Lead "${lead.name}" (${lead.phone}) is not in blocklist. Restoring to Fresh...`);
          lead.status = 'Fresh';
          lead.activities.unshift({
            type: 'status_change',
            description: 'Status changed from Blocked to Fresh after database synchronization',
            performedBy: null,
          });
          await lead.save();
        }
      }
    }
  } catch (syncErr) {
    console.error('[DB SYNC] Sync error:', syncErr.message);
  }
}

module.exports = connectDB;