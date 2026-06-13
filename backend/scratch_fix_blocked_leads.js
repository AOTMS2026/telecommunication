const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

const Lead = require('./src/models/Lead');
const Blocklist = require('./src/models/Blocklist');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // Find all leads with status 'Blocked'
    const blockedLeads = await Lead.find({ status: 'Blocked' });
    console.log(`Found ${blockedLeads.length} leads with Blocked status.`);

    for (const lead of blockedLeads) {
      const cleanPhone = String(lead.phone || '').replace(/\D/g, '');
      
      // Check if this phone number is in the Blocklist collection
      const isBlocked = await Blocklist.findOne({ phone: cleanPhone });
      
      if (!isBlocked) {
        console.log(`Lead "${lead.name}" (${lead.phone}) is not in blocklist. Restoring to Fresh...`);
        lead.status = 'Fresh';
        lead.activities.unshift({
          type: 'status_change',
          description: `Status changed from Blocked to Fresh after database synchronization`,
          performedBy: null,
        });
        await lead.save();
      } else {
        console.log(`Lead "${lead.name}" (${lead.phone}) is correctly blocked.`);
      }
    }

    await mongoose.disconnect();
    console.log('Done.');
  } catch (err) {
    console.error(err);
  }
}

run();
