// backend/src/services/aiCaller/orchestrator.js
//
// Node.js replacement for the entire Python RunPod stack (server.py +
// stt.py + tts.py + gpt_client.py + memory_client.py + outcome_client.py).
//
// Architecture change: now that STT and TTS are Sarvam API calls (HTTP),
// the orchestrator is just a WebSocket handler that sequences those calls.
// No GPU needed. Runs in-process inside the existing Node.js backend on
// Render — no separate RunPod pod, no Docker image, no Python.
//
// Exotel AgentStream WebSocket protocol:
//   Exotel → orchestrator: "connected", "start", "media", "dtmf", "stop"
//   Orchestrator → Exotel: "media" (audio), "mark" (playback sync), "clear" (barge-in)
// Reference: https://developer.exotel.com/docs/agentstream/developer-guide

const axios = require('axios');
const { transcribeAudio, synthesizeSpeech } = require('./sarvamClient');
const { buildSystemPrompt, buildWelcomeGreeting, buildOutcomeExtractionPrompt } = require('./promptBuilder');
const { buildMemoryBlock } = require('./conversationMemory');
const { applyAiCallOutcome, applyNoConnectOutcome } = require('./outcomeService');
const Lead = require('../../models/Lead');

// ─── Config ─────────────────────────────────────────────────────────────────

// VAD: treat ≥30 consecutive ~20ms silent frames (~600ms) as end of speech.
// Exotel sends 8kHz PCM16 frames; silence = RMS near 0.
const SILENCE_FRAME_THRESHOLD = 30;
const SILENCE_RMS_CUTOFF = 400;

// Exotel requires audio chunks to be multiples of 320 bytes.
// 1600 bytes = 5 × 320 = 100ms at 8kHz mono PCM16.
const EXOTEL_FRAME_BYTES = 1600;

// Marker GPT inserts when it wants to end the call naturally.
const END_CALL_MARKER = '[[END_CALL]]';

// ─── OpenAI (GPT-4.1-mini) via axios ─────────────────────────────────────────

async function getAgentReply(messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4.1-mini',
      messages,
      temperature: 0.6,
      max_tokens: 120,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 12000,
    }
  );
  return (response.data.choices?.[0]?.message?.content || '').trim() || 'Sorry, could you say that again?';
}

async function getCallOutcome(outcomeExtractionPrompt, transcriptMessages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4.1-mini',
        messages: [outcomeExtractionPrompt, ...transcriptMessages],
        temperature: 0.2,
        max_tokens: 300,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 20000,
      }
    );
    const raw = (response.data.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim();
    return JSON.parse(raw);
  } catch {
    return {
      leadStatus: 'Connected',
      interestLevel: 'Unknown',
      studentIntent: 'general_interest',
      followUpRequired: false,
      followUpDate: null,
      demoRequired: false,
      callbackReason: '',
      conversationSummary: 'AI call completed. Summary unavailable.',
      nextRecommendedAction: 'no_action',
      confidenceScore: 0.0,
    };
  }
}

// ─── RMS silence helper ─────────────────────────────────────────────────────

function rms(pcm16Chunk) {
  if (!pcm16Chunk || pcm16Chunk.length < 2) return 0;
  let sum = 0;
  const len = Math.floor(pcm16Chunk.length / 2);
  for (let i = 0; i < len; i++) {
    // Read signed int16 little-endian
    let sample = pcm16Chunk.readInt16LE(i * 2);
    sum += sample * sample;
  }
  return Math.sqrt(sum / len);
}

// ─── Send TTS audio to Exotel ────────────────────────────────────────────────

async function sendTts(ws, session, text) {
  if (!text || !text.trim()) return;

  let pcm16;
  try {
    const langCode = session.language === 'English' ? 'en-IN' : 'te-IN';
    pcm16 = await synthesizeSpeech(text, langCode);
  } catch (err) {
    console.error(`[orchestrator] TTS failed (${session.callSid}):`, err.message);
    return;
  }

  if (!pcm16 || pcm16.length === 0) return;

  session.agentSpeaking = true;
  try {
    // Chunk into EXOTEL_FRAME_BYTES multiples, pad last frame to 320-byte boundary
    for (let offset = 0; offset < pcm16.length; offset += EXOTEL_FRAME_BYTES) {
      let frame = pcm16.slice(offset, offset + EXOTEL_FRAME_BYTES);
      const rem = frame.length % 320;
      if (rem !== 0) {
        const padded = Buffer.alloc(frame.length + (320 - rem));
        frame.copy(padded);
        frame = padded;
      }
      ws.send(JSON.stringify({
        event: 'media',
        stream_sid: session.streamSid,
        media: { payload: frame.toString('base64') },
      }));
    }
    // Mark signals end of this utterance (for barge-in re-arming)
    ws.send(JSON.stringify({
      event: 'mark',
      stream_sid: session.streamSid,
      mark: { name: `reply-${Date.now()}` },
    }));
  } finally {
    session.agentSpeaking = false;
  }
}

// ─── Speech segment processing ────────────────────────────────────────────────

async function processSpeechSegment(ws, session, pcm16Bytes) {
  // STT
  let text;
  try {
    text = await transcribeAudio(Buffer.from(pcm16Bytes));
  } catch (err) {
    console.error(`[orchestrator] STT failed (${session.callSid}):`, err.message);
    return false;
  }
  if (!text) return false;

  console.log(`[orchestrator] STT (${session.callSid}): "${text}"`);
  session.conversation.push({ role: 'user', content: text });

  // GPT-4.1-mini
  let reply;
  try {
    reply = await getAgentReply(session.conversation);
  } catch (err) {
    console.error(`[orchestrator] GPT failed (${session.callSid}):`, err.message);
    reply = 'ఒక్క నిమిషం, మళ్ళీ చెప్పగలరా?'; // "One moment, could you repeat that?" in Telugu
  }

  const shouldEnd = reply.includes(END_CALL_MARKER);
  const spokenReply = reply.replace(END_CALL_MARKER, '').trim();

  console.log(`[orchestrator] GPT (${session.callSid}): "${spokenReply}"${shouldEnd ? ' [END]' : ''}`);
  session.conversation.push({ role: 'assistant', content: spokenReply });

  try {
    await sendTts(ws, session, spokenReply);
  } catch (err) {
    console.error(`[orchestrator] sendTts failed (${session.callSid}):`, err.message);
  }

  return shouldEnd;
}

// ─── Call end — save outcome to MongoDB directly ─────────────────────────────

async function finalizeCall(session) {
  const durationSeconds = Math.floor((Date.now() - session.startedAt) / 1000);
  const hadConversation = session.conversation.some(m => m.role === 'user');

  console.log(`[orchestrator] finalizing call ${session.callSid} (${durationSeconds}s, spoke: ${hadConversation})`);

  if (!session.leadId || !hadConversation) {
    // No conversation happened — just release the lock/state
    if (session.leadId) {
      await Lead.updateOne({ _id: session.leadId }, { aiCallState: 'completed' }).catch(() => {});
    }
    return;
  }

  const transcriptMessages = session.conversation.filter(m => m.role !== 'system');
  const transcriptText = transcriptMessages
    .map(m => `${m.role === 'user' ? 'Student' : 'Agent'}: ${m.content}`)
    .join('\n');

  const outcome = await getCallOutcome(
    session.outcomeExtractionPrompt || {
      role: 'system',
      content: 'Summarize this call as JSON with key conversationSummary.',
    },
    transcriptMessages
  );

  if (outcome) {
    await applyAiCallOutcome(session.leadId, outcome, {
      durationSeconds,
      transcript: transcriptText,
      campaignId: session.campaignId || undefined,
      callSid: session.callSid,
    }).catch(err => console.error('[orchestrator] applyAiCallOutcome failed:', err.message));
  }
}

// ─── Main WebSocket handler ───────────────────────────────────────────────────

/**
 * Called once per incoming Exotel WebSocket connection by server.js.
 * Each call gets its own session object and its own independent async loop.
 */
async function handleCall(ws, req) {
  // Extract leadId/campaignId from the WS URL query string
  // (Exotel passes these in the streamurl we set in dialer.js)
  const url = new URL(req.url, 'http://localhost');
  const leadId = url.searchParams.get('leadId') || url.searchParams.get('leadid');
  const campaignId = url.searchParams.get('campaignId') || url.searchParams.get('campaignid');

  console.log(`[orchestrator] new connection leadId=${leadId}`);

  const session = {
    callSid: '',
    streamSid: '',
    leadId,
    campaignId,
    conversation: [],
    outcomeExtractionPrompt: null,
    language: null,
    startedAt: Date.now(),
    audioBuffer: Buffer.alloc(0),
    silenceRun: 0,
    agentSpeaking: false,
  };

  // Load call context (system prompt, memory) from DB — in-process, no HTTP call
  if (leadId) {
    try {
      const lead = await Lead.findById(leadId).populate('courseInterest', 'name');
      if (lead) {
        session.language = lead.language || 'Telugu';
        const memoryBlock = await buildMemoryBlock(leadId);
        const systemPrompt = buildSystemPrompt(lead, memoryBlock);
        const welcomeGreeting = buildWelcomeGreeting(lead);
        session.outcomeExtractionPrompt = buildOutcomeExtractionPrompt();
        session.conversation = [{ role: 'system', content: systemPrompt }];
        session.pendingGreeting = welcomeGreeting;
      }
    } catch (err) {
      console.error('[orchestrator] failed to load call context:', err.message);
      session.conversation = [{
        role: 'system',
        content: 'You are Priya, a friendly course counselor from AOTMS. Keep replies short. Speak in Telugu.',
      }];
    }
  }

  ws.on('message', async (raw) => {
    let message;
    try { message = JSON.parse(raw); } catch { return; }

    const event = message.event;

    if (event === 'connected') {
      console.log('[orchestrator] Exotel handshake: connected');
    } else if (event === 'start') {
      const start = message.start || {};
      session.callSid = start.call_sid || '';
      session.streamSid = start.stream_sid || '';

      // Override leadId/campaignId from custom_parameters if Exotel sends them
      const params = start.custom_parameters || {};
      if (params.leadId) session.leadId = params.leadId;
      if (params.campaignId) session.campaignId = params.campaignId;

      console.log(`[orchestrator] call started: ${session.callSid} lead=${session.leadId}`);

      // Send welcome greeting
      if (session.pendingGreeting) {
        session.conversation.push({ role: 'assistant', content: session.pendingGreeting });
        await sendTts(ws, session, session.pendingGreeting).catch(err =>
          console.error('[orchestrator] welcome TTS failed:', err.message)
        );
        session.pendingGreeting = null;
      }

    } else if (event === 'media') {
      const payload = message.media?.payload;
      if (!payload) return;

      const chunk = Buffer.from(payload, 'base64');

      // Barge-in: if agent is speaking and caller starts talking, clear queued audio
      const chunkRms = chunk.length >= 2 ? rms(chunk) : 0;
      const isSilent = chunkRms < SILENCE_RMS_CUTOFF;

      if (!isSilent && session.agentSpeaking) {
        ws.send(JSON.stringify({ event: 'clear', stream_sid: session.streamSid }));
        session.agentSpeaking = false;
      }

      session.audioBuffer = Buffer.concat([session.audioBuffer, chunk]);
      session.silenceRun = isSilent ? session.silenceRun + 1 : 0;

      if (session.silenceRun >= SILENCE_FRAME_THRESHOLD && session.audioBuffer.length > 0) {
        const segment = Buffer.from(session.audioBuffer);
        session.audioBuffer = Buffer.alloc(0);
        session.silenceRun = 0;

        let shouldEnd = false;
        try {
          shouldEnd = await Promise.race([
            processSpeechSegment(ws, session, segment),
            new Promise(resolve => setTimeout(() => resolve(false), 12000)),
          ]);
        } catch (err) {
          console.error('[orchestrator] processSpeechSegment error:', err.message);
        }

        if (shouldEnd) {
          await finalizeCall(session);
          ws.close();
        }
      }

    } else if (event === 'dtmf') {
      const digit = message.dtmf?.digit || '';
      console.log(`[orchestrator] dtmf: ${digit} (${session.callSid})`);

    } else if (event === 'stop') {
      await finalizeCall(session);
    }
  });

  ws.on('close', () => {
    console.log(`[orchestrator] WS closed: ${session.callSid}`);
    // If the socket closed without a 'stop' event (e.g. network drop),
    // still try to save whatever conversation happened.
    if (session.conversation.some(m => m.role === 'user')) {
      finalizeCall(session).catch(() => {});
    }
  });

  ws.on('error', (err) => {
    console.error(`[orchestrator] WS error (${session.callSid}):`, err.message);
  });
}

module.exports = { handleCall };