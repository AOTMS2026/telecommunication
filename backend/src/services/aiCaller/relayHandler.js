const Lead = require('../../models/Lead');
const { getAgentReply, getCallOutcome } = require('./openrouterClient');
const { buildSystemPrompt } = require('./promptBuilder');
const { createSession, getSession, updateSession, deleteSession } = require('./sessionStore');
const { applyAiCallOutcome } = require('./outcomeService');

/**
 * Handles a single ConversationRelay WebSocket connection (one per phone call).
 */
function handleConversationRelay(ws) {
  ws.on('message', async (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch (err) {
      console.error('[relay] bad JSON from Twilio:', raw.toString());
      return;
    }

    switch (message.type) {
      case 'setup':
        await handleSetup(ws, message);
        break;
      case 'prompt':
        await handlePrompt(ws, message);
        break;
      case 'interrupt':
        console.log('[relay] interrupt:', message);
        break;
      case 'error':
        console.error('[relay] ConversationRelay error:', message);
        break;
      default:
        console.log('[relay] unhandled message type:', message.type);
    }
  });

  ws.on('close', async () => {
    await finalizeCall(ws.callSid);
  });
}

async function handleSetup(ws, message) {
  const callSid = message.callSid;
  ws.callSid = callSid;

  const leadId = message.customParameters?.leadId;
  console.log('[relay] setup for call', callSid, 'leadId:', leadId);

  let lead = null;
  if (leadId) {
    try {
      lead = await Lead.findById(leadId).populate('courseInterest', 'name');
    } catch (err) {
      console.error('[relay] failed to load lead', err.message);
    }
  }

  const systemPrompt = lead
    ? buildSystemPrompt(lead)
    : 'You are Priya, a friendly course counselor from AOTMS. Keep replies short.';

  createSession(callSid, {
    leadId: leadId || null,
    conversation: [{ role: 'system', content: systemPrompt }],
  });
}

async function handlePrompt(ws, message) {
  const callSid = ws.callSid;
  const session = getSession(callSid);
  if (!session) {
    console.error('[relay] no session for callSid', callSid);
    return;
  }

  if (message.last === false) return;

  const userText = message.voicePrompt;
  session.conversation.push({ role: 'user', content: userText });

  const reply = await getAgentReply(session.conversation);
  session.conversation.push({ role: 'assistant', content: reply });

  updateSession(callSid, { conversation: session.conversation });

  ws.send(JSON.stringify({
    type: 'text',
    token: reply,
    last: true,
  }));
}

async function finalizeCall(callSid) {
  if (!callSid) return;
  const session = getSession(callSid);
  if (!session) return;

  try {
    const { leadId, conversation, startedAt } = session;
    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);

    const hadConversation = conversation.some(m => m.role === 'user');

    if (leadId && hadConversation) {
      const transcript = conversation
        .filter(m => m.role !== 'system')
        .map(m => `${m.role === 'user' ? 'Student' : 'Agent'}: ${m.content}`)
        .join('\n');

      const outcome = await getCallOutcome(conversation.filter(m => m.role !== 'system'));
      await applyAiCallOutcome(leadId, outcome, { durationSeconds, transcript });
      console.log('[relay] call finalized for lead', leadId, outcome);
    } else {
      console.log('[relay] call ended with no conversation, leadId:', leadId);
    }
  } catch (err) {
    console.error('[relay] finalizeCall error:', err.message);
  } finally {
    deleteSession(callSid);
  }
}

module.exports = { handleConversationRelay };
