// Nodemon restart trigger v5
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const connectDB = require('./config/db');
const { initFCM } = require('./services/fcm');
const http = require('node:http');
require('./models/ImportHistory'); // add this line
const { WebSocketServer } = require('ws');
const { handleConversationRelay } = require('./services/aiCaller/relayHandler');
const { startSchedulePoller } = require('./services/workflowEngine');
const { startOverdueTaskChecker } = require('./services/taskOverdueChecker');
const campaignEngine = require('./services/aiCaller/campaignEngine'); // NEW
const callbackEngine = require('./services/aiCaller/callbackEngine'); // NEW
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const app = express();
connectDB();

// Initialize Firebase Cloud Messaging for push notifications
initFCM();

// ── Security ─────────────────────────────────────────────────────────────────
const allowedOrigin = process.env.FRONTEND_URL || '*';
app.use(cors({ origin: allowedOrigin, credentials: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { message: 'Too many requests. Slow down.' },
});

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());

if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/leads', apiLimiter, require('./routes/leads'));
app.use('/api/followups', apiLimiter, require('./routes/followups'));
app.use('/api/campaigns', apiLimiter, require('./routes/campaigns'));
app.use('/api/reports', apiLimiter, require('./routes/reports'));
app.use('/api/users', apiLimiter, require('./routes/users'));
app.use('/api/courses', apiLimiter, require('./routes/courses'));
app.use('/api/blocklist', apiLimiter, require('./routes/blocklist'));
app.use('/api/message-templates', apiLimiter, require('./routes/messageTemplates'));
app.use('/api/bulk-import', apiLimiter, require('./routes/bulkImport'));
app.use('/api/ai-caller', require('./routes/aiCaller'));
app.use('/api/integrations', require('./routes/integrations'));
app.use('/api/notifications', apiLimiter, require('./routes/notifications'));
app.use('/api/recordings', apiLimiter, require('./routes/recordings'));

// Serve uploaded call recordings so the URLs returned by /api/recordings work
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Automation & API suite (Workflows, Schedules, Salesforms, API Templates,
//    Webhooks, Access Tokens, Call-IQ Agents) ──────────────────────────────────
app.use('/api/workflows', apiLimiter, require('./routes/workflows'));
app.use('/api/salesforms', apiLimiter, require('./routes/salesforms'));
app.use('/api/api-templates', apiLimiter, require('./routes/apiTemplates'));
app.use('/api/webhooks', apiLimiter, require('./routes/webhooks'));
app.use('/api/access-tokens', apiLimiter, require('./routes/accessTokens'));
app.use('/api/call-iq-agents', apiLimiter, require('./routes/callIqAgents'));
app.use('/api/mcp', apiLimiter, require('./routes/mcp'));

// ── Workspace Settings (Lead Stage, Call Feedback, Custom Actions, Preferences,
//    Permission Templates) ────────────────────────────────────────────────────
app.use('/api/lead-stages', apiLimiter, require('./routes/leadStages'));
app.use('/api/lead-fields', apiLimiter, require('./routes/leadFields'));
app.use('/api/call-feedback', apiLimiter, require('./routes/callFeedback'));
app.use('/api/custom-actions', apiLimiter, require('./routes/customActions'));
app.use('/api/workspace-preferences', apiLimiter, require('./routes/workspacePreferences'));
app.use('/api/permission-templates', apiLimiter, require('./routes/permissionTemplates'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'AOTMS Backend' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// ── WebSocket server for Twilio ConversationRelay ─────────────────────────────
// DEPRECATED, NOT REMOVED: audio is now routed to the RunPod pod via raw Media
// Streams (see routes/aiCaller.js's /twiml handler), so this mount receives no
// traffic under the new flow. Left registered (harmless — Twilio simply never
// opens a connection here anymore) for one full release cycle as a same-process
// rollback path: reverting routes/aiCaller.js's TwiML back to
// connect.conversationRelay(...) brings this path back online instantly with
// zero further code changes. Remove only after the RunPod flow is confirmed
// stable in production (see migration plan §9, Rollback Plan).
const wss = new WebSocketServer({ server, path: '/ai-caller/relay' });
wss.on('connection', (ws) => handleConversationRelay(ws));

// ── NEW: AI Telecaller background engines ─────────────────────────────────────
// Autonomous campaign dialer + intelligent callback re-dialer. Both follow the
// same setInterval poller pattern as workflowEngine.startSchedulePoller(), so no
// new job-queue dependency (Redis/Bull) is introduced.
campaignEngine.startPoller();
callbackEngine.startPoller();

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  server.listen(PORT, () => console.log(`🚀 AOTMS Server running on port ${PORT}`));
  // Poll for due SCHEDULE-kind workflow executions every minute.
  startSchedulePoller(60 * 1000);
  // Sweep for overdue tasks/follow-ups every 5 minutes and notify once each.
  startOverdueTaskChecker(5 * 60 * 1000);
}

module.exports = app;