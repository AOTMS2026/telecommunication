const mongoose = require('mongoose');
const dns = require('dns');

// Fix for "querySrv ECONNREFUSED" on Windows — default OS DNS resolver
// often fails to resolve mongodb+srv SRV records. Force Google DNS.
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Sync blocklist and leads status on startup
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
              description: `Status changed from Blocked to Fresh after database synchronization`,
              performedBy: null,
            });
            await lead.save();
          }
        }
      }
    } catch (syncErr) {
      console.error('[DB SYNC] Sync error:', syncErr.message);
    }
  } catch (error) {
    console.error(`MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;