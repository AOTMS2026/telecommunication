/**
 * AOTMS - Seed Users + Leads (real dataset from test_leads.json)
 *
 * Creates/updates the given Admin, Manager, and Caller accounts, then
 * upserts the real leads exported from test_leads.json (courseInterest,
 * campaign and old assignedTo refs are dropped since those ObjectIds
 * belong to a different DB - leads are re-assigned to Mahesh, the caller).
 * Phone numbers are normalized to last-10-digits by the Lead schema setter.
 *
 * Run (from the backend/ folder):
 *   node seedUsersAndLeads.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');
const Lead = require('./src/models/Lead');
const { normalizePhone10 } = require('./src/utils/phone');

const USERS = [
  { name: 'Ameen',   email: 'ameenaotms@gmail.com',        password: 'Ameen@aotms',   role: 'admin' },
  { name: 'CTO',     email: 'ctoaotms@gmail.com',          password: 'Rabbani@aotms', role: 'admin' },
  { name: 'HR',      email: 'hraotms@gmail.com',           password: 'Deenaz@aotms',  role: 'manager' },
  { name: 'Hiring',  email: 'hiringaotms@gmail.com',       password: 'Bhavani@aotms', role: 'manager' },
  { name: 'Mahesh',  email: 'maheshchoudare21@gmail.com',  password: 'Mahesh@2005',   role: 'caller' },
];

const LEADS = [
  {"name":"Para Pranadeep","phone":"916305468518","alternatePhone":"","email":"pranadeep@gmail.com","status":"Call Not Responding","rating":2,"leadSource":"Facebook","preferredCourses":["B.Tech"],"mode":"Online","budget":50000,"location":"Hyderabad","lastQualification":"Graduate","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Syed Abdul Ajees","phone":"919912916365","alternatePhone":"","email":"ajees@gmail.com","status":"Demo Scheduled","rating":4,"leadSource":"Facebook","preferredCourses":["MBA"],"mode":"Hybrid","budget":60000,"location":"Vijayawada","lastQualification":"Post-Graduate","collegeName":"","language":"Telugu","isStarred":true},
  {"name":"Thahir","phone":"919618620700","alternatePhone":"","email":"thahir@gmail.com","status":"Fresh","rating":0,"leadSource":"Facebook","preferredCourses":["BBA"],"mode":"Offline","budget":40000,"location":"Chennai","lastQualification":"Under Graduate","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Sanjay Kumar","phone":"917264003651","alternatePhone":"","email":"sanjay@gmail.com","status":"Fresh","rating":0,"leadSource":"WhatsApp","preferredCourses":["MCA"],"mode":"Online","budget":45000,"location":"Bangalore","lastQualification":"","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Sateesh Reddy","phone":"919642250062","alternatePhone":"","email":"sateesh@gmail.com","status":"Fresh","rating":1,"leadSource":"Website","preferredCourses":["B.Tech"],"mode":"Online","budget":55000,"location":"Guntur","lastQualification":"Graduate","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Navuluri Ankitha","phone":"919110700548","alternatePhone":"","email":"ankitha@gmail.com","status":"Call Back Later","rating":3,"leadSource":"Facebook","preferredCourses":["MBA"],"mode":"Hybrid","budget":65000,"location":"Hyderabad","lastQualification":"Post-Graduate","collegeName":"","language":"Telugu","isStarred":true},
  {"name":"Athota Varunteja","phone":"918500654680","alternatePhone":"","email":"varunteja@gmail.com","status":"Not interested","rating":1,"leadSource":"Facebook","preferredCourses":["BBA"],"mode":"Offline","budget":35000,"location":"Tirupati","lastQualification":"Under Graduate","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Jallela Annamaiah","phone":"919642865520","alternatePhone":"","email":"annamaiah@gmail.com","status":"Call Not Responding","rating":2,"leadSource":"Manual","preferredCourses":["B.Tech"],"mode":"Online","budget":50000,"location":"Kurnool","lastQualification":"","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Narne Ajay","phone":"919392506567","alternatePhone":"","email":"ajay@gmail.com","status":"Not interested","rating":0,"leadSource":"Facebook","preferredCourses":["MCA"],"mode":"Online","budget":42000,"location":"Nellore","lastQualification":"Graduate","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Mellempudi Vijaya Naga","phone":"918897699676","alternatePhone":"","email":"vijayanaga@gmail.com","status":"Not interested","rating":1,"leadSource":"Website","preferredCourses":["B.Tech"],"mode":"Hybrid","budget":48000,"location":"Vizag","lastQualification":"Post-Graduate","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Gundala Vamsi Krishna","phone":"916281477638","alternatePhone":"","email":"vamsi@gmail.com","status":"Call Not Responding","rating":2,"leadSource":"Facebook","preferredCourses":["MBA"],"mode":"Online","budget":70000,"location":"Hyderabad","lastQualification":"Under Graduate","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Nambula Gopi Krishna","phone":"919949396016","alternatePhone":"","email":"gopi@gmail.com","status":"Fresh","rating":0,"leadSource":"WhatsApp","preferredCourses":["BBA"],"mode":"Offline","budget":38000,"location":"Ongole","lastQualification":"","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Jalasuthram Durgabhavani","phone":"918885441234","alternatePhone":"","email":"durga@gmail.com","status":"Not interested","rating":1,"leadSource":"Facebook","preferredCourses":["MBA"],"mode":"Hybrid","budget":60000,"location":"Kakinada","lastQualification":"Graduate","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Pinneboyina Ganesh","phone":"917799001122","alternatePhone":"","email":"ganesh@gmail.com","status":"Not interested","rating":0,"leadSource":"Manual","preferredCourses":["M.Tech"],"mode":"Online","budget":55000,"location":"Rajahmundry","lastQualification":"Post-Graduate","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Guttikonda Lokesh","phone":"919123456780","alternatePhone":"","email":"lokesh@gmail.com","status":"Call Not Responding","rating":2,"leadSource":"Facebook","preferredCourses":["B.Tech"],"mode":"Online","budget":47000,"location":"Eluru","lastQualification":"Under Graduate","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Ramya Krishnan","phone":"918800112233","alternatePhone":"","email":"ramya@gmail.com","status":"Fresh","rating":1,"leadSource":"Facebook","preferredCourses":["MBA"],"mode":"Online","budget":80000,"location":"Chennai","lastQualification":"","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Suresh Babu","phone":"917700223344","alternatePhone":"","email":"suresh@gmail.com","status":"Connected","rating":3,"leadSource":"Website","preferredCourses":["MBA"],"mode":"Hybrid","budget":75000,"location":"Hyderabad","lastQualification":"Graduate","collegeName":"","language":"Telugu","isStarred":true},
  {"name":"Priya Lakshmi","phone":"916600334455","alternatePhone":"","email":"priya@gmail.com","status":"Demo Scheduled","rating":4,"leadSource":"WhatsApp","preferredCourses":["MBA","BBA"],"mode":"Hybrid","budget":72000,"location":"Bangalore","lastQualification":"Post-Graduate","collegeName":"","language":"Telugu","isStarred":true},
  {"name":"Kiran Reddy","phone":"915500445566","alternatePhone":"","email":"kiran@gmail.com","status":"Call Back Later","rating":3,"leadSource":"Manual","preferredCourses":["MBA"],"mode":"Online","budget":68000,"location":"Vijayawada","lastQualification":"Under Graduate","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Anjali Sharma","phone":"914400556677","alternatePhone":"","email":"anjali@gmail.com","status":"Won","rating":5,"leadSource":"Facebook","preferredCourses":["MBA"],"mode":"Online","budget":90000,"location":"Mumbai","lastQualification":"","collegeName":"","language":"Telugu","isStarred":true},
  {"name":"Deepika Nair","phone":"913311667788","alternatePhone":"","email":"deepika@gmail.com","status":"Demo Done","rating":4,"leadSource":"Facebook","preferredCourses":["MBA"],"mode":"Hybrid","budget":78000,"location":"Pune","lastQualification":"Graduate","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Rohit Khanna","phone":"912299887766","alternatePhone":"","email":"rohit@gmail.com","status":"Connected","rating":3,"leadSource":"Website","preferredCourses":["MBA"],"mode":"Online","budget":82000,"location":"Delhi","lastQualification":"Post-Graduate","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Vikram Rao","phone":"913300667788","alternatePhone":"","email":"vikram@gmail.com","status":"Fresh","rating":0,"leadSource":"Facebook","preferredCourses":["BBA"],"mode":"Online","budget":35000,"location":"Hyderabad","lastQualification":"Under Graduate","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Meena Kumari","phone":"912200778899","alternatePhone":"","email":"meena@gmail.com","status":"Not interested","rating":0,"leadSource":"Website","preferredCourses":["BBA"],"mode":"Offline","budget":32000,"location":"Tirupati","lastQualification":"","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Deepak Varma","phone":"911100889900","alternatePhone":"","email":"deepak@gmail.com","status":"Connected","rating":2,"leadSource":"WhatsApp","preferredCourses":["BBA"],"mode":"Hybrid","budget":38000,"location":"Guntur","lastQualification":"Graduate","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Swati Patel","phone":"910099778866","alternatePhone":"","email":"swati@gmail.com","status":"Call Back Later","rating":1,"leadSource":"Facebook","preferredCourses":["BBA"],"mode":"Online","budget":36000,"location":"Surat","lastQualification":"Post-Graduate","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Harish Gupta","phone":"919988776655","alternatePhone":"","email":"harish@gmail.com","status":"Fresh","rating":0,"leadSource":"Manual","preferredCourses":["BBA"],"mode":"Offline","budget":33000,"location":"Jaipur","lastQualification":"Under Graduate","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"swathi","phone":"6305768615","alternatePhone":"","email":"swathiraguthu@gmail.com","status":"Fresh","rating":0,"leadSource":"Manual","preferredCourses":["B.Tech"],"mode":"","budget":35000,"location":"vijayawada","lastQualification":"","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"javed","phone":"7842629682","alternatePhone":"","email":"","status":"Connected","rating":0,"leadSource":"Manual","preferredCourses":[],"mode":"","budget":0,"location":"","lastQualification":"","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"Mahesh Gutha","phone":"8639271799","alternatePhone":"","email":"","status":"Connected","rating":0,"leadSource":"Manual","preferredCourses":[],"mode":"","budget":0,"location":"","lastQualification":"","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"RAVIHAL PARIDI SIRISHA","phone":"9346491741","alternatePhone":"9346491741","email":"sirishaparidi@gmail.com","status":"Fresh","rating":0,"leadSource":"Google Sheets","preferredCourses":[],"mode":"","budget":0,"location":"Adoni","lastQualification":"","collegeName":"St. John's College Of Engineering And Technology","language":"Telugu","isStarred":false},
  {"name":"Angadi Sai Yashwanth","phone":"8247736654","alternatePhone":"8247736654","email":"yashwanthasai4@gmail.com","status":"Fresh","rating":0,"leadSource":"Google Sheets","preferredCourses":[],"mode":"","budget":0,"location":"Adoni","lastQualification":"","collegeName":"St johns college of Engineering & Technology","language":"Telugu","isStarred":false},
  {"name":"Golla veeresh","phone":"7075497091","alternatePhone":"7075497091","email":"gollaveeresh37@gmail.com","status":"Fresh","rating":0,"leadSource":"Google Sheets","preferredCourses":[],"mode":"","budget":0,"location":"ADONI","lastQualification":"","collegeName":"St johns collage of engineering and technology","language":"Telugu","isStarred":false},
  {"name":"C N Sana Tabassun","phone":"9494191051","alternatePhone":"9494191051","email":"sanatabassum1023@gmail.com","status":"Fresh","rating":0,"leadSource":"Google Sheets","preferredCourses":[],"mode":"","budget":0,"location":"Adoni","lastQualification":"","collegeName":"St Johns College Of Engineering And Technology","language":"Telugu","isStarred":false},
  {"name":"Swathi Raguthu","phone":"630568615","alternatePhone":"630568615","email":"swathiraguthu@gmail.com","status":"Fresh","rating":0,"leadSource":"Google Sheets","preferredCourses":[],"mode":"","budget":0,"location":"Vijayawada","lastQualification":"","collegeName":"ALIET","language":"Telugu","isStarred":false},
  {"name":"Anushka","phone":"9959197097","alternatePhone":"9959197097","email":"anuraguthu31@gmail.com","status":"Fresh","rating":0,"leadSource":"Google Sheets","preferredCourses":[],"mode":"","budget":0,"location":"Vijayawada","lastQualification":"","collegeName":"ALIET","language":"Telugu","isStarred":false},
  {"name":"abc","phone":"5679813232","alternatePhone":"5679813232","email":"abchhhf@gmail.com","status":"Fresh","rating":0,"leadSource":"Google Sheets","preferredCourses":[],"mode":"","budget":0,"location":"Vijayawada","lastQualification":"","collegeName":"ABC","language":"Telugu","isStarred":false},
  {"name":"mahesh","phone":"57894562","alternatePhone":"57894562","email":"mahehschoudare21@gmail.com","status":"Fresh","rating":0,"leadSource":"Google Sheets","preferredCourses":[],"mode":"","budget":0,"location":"","lastQualification":"","collegeName":"","language":"Telugu","isStarred":false},
  {"name":"mahesh","phone":"8639271199","alternatePhone":"8639271199","email":"mahehschoudare21@gmail.com","status":"Fresh","rating":0,"leadSource":"Google Sheets","preferredCourses":[],"mode":"","budget":0,"location":"Vijayawada","lastQualification":"","collegeName":"sffffgf","language":"Telugu","isStarred":false}
];

async function upsertUser({ name, email, password, role }) {
  let user = await User.findOne({ email });
  if (user) {
    user.name = name;
    user.password = password; // pre-save hook re-hashes since it's modified
    user.role = role;
    user.isActive = true;
    await user.save();
    console.log(`Updated ${role}: ${email}`);
  } else {
    user = await User.create({ name, email, password, role });
    console.log(`Created ${role}: ${email}`);
  }
  return user;
}

async function upsertLead(data, assignedToId) {
  const phone10 = normalizePhone10(data.phone);
  const existing = await Lead.findOne({ phone: phone10 });
  if (existing) {
    Object.assign(existing, data, { phone: phone10 });
    await existing.save();
    console.log(`Updated lead: ${existing.name} (${existing.phone})`);
    return existing;
  }
  const lead = await Lead.create({ ...data, phone: phone10, assignedTo: assignedToId });
  console.log(`Created lead: ${lead.name} (${lead.phone})`);
  return lead;
}

// Repairs any lead already sitting in the DB with a phone that isn't
// exactly 10 digits (e.g. imported/restored data that bypassed the
// Mongoose setter, like a 12-digit "916305468518"). Runs before the
// upserts above so lookups by normalized phone actually match.
async function fixLegacyPhones() {
  const all = await Lead.find({}).select('_id phone alternatePhone');
  let fixed = 0, skipped = 0;
  for (const lead of all) {
    const newPhone = normalizePhone10(lead.phone);
    const newAlt = normalizePhone10(lead.alternatePhone);
    if (newPhone === lead.phone && newAlt === (lead.alternatePhone || '')) continue;
    try {
      lead.phone = newPhone;
      lead.alternatePhone = newAlt;
      await lead.save();
      fixed++;
    } catch (err) {
      // e.g. fewer than 10 digits available — can't be fixed automatically
      console.warn(`Skipped invalid phone on lead ${lead._id}: ${err.message}`);
      skipped++;
    }
  }
  console.log(`Legacy phone repair: fixed ${fixed}, skipped ${skipped} (of ${all.length} leads).`);
}

async function run() {
  await connectDB();

  const createdUsers = {};
  for (const u of USERS) {
    createdUsers[u.email] = await upsertUser(u);
  }

  await fixLegacyPhones();

  const caller = createdUsers['maheshchoudare21@gmail.com'];
  for (const l of LEADS) {
    try {
      await upsertLead(l, caller._id);
    } catch (err) {
      console.warn(`Skipped lead "${l.name}" (${l.phone}): ${err.message}`);
    }
  }

  console.log(`\nSeed complete: ${USERS.length} users, ${LEADS.length} leads.`);
  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});