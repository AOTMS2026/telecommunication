// backend/src/services/aiCaller/orchestrator.js
//
// LATENCY REWRITE — pipeline is now fully streaming/overlapped instead of
// sequential STT -> full-LLM-reply -> TTS:
//   - STT runs continuously via a persistent Sarvam streaming socket
//     (sarvamClient.createSttSession) fed every incoming Exotel audio frame,
//     so the transcript is usually ready before local silence is even
//     detected. REST transcribeAudio() is only a fallback.
//   - LLM reply is streamed from OpenAI (stream: true) and chopped into
//     sentence-sized chunks; each chunk is sent to TTS the instant it's
//     ready instead of waiting for the full reply.
//   - TTS runs on one persistent Sarvam socket per call
//     (sarvamClient.createTtsSession), reused across turns, instead of a
//     fresh WebSocket handshake every reply.
//   - Conversation history sent to the LLM is capped so later turns in long
//     calls don't reprocess ever-growing context.
//
// Exotel AgentStream WebSocket protocol:
//   Exotel → orchestrator: "connected", "start", "media", "dtmf", "stop"
//   Orchestrator → Exotel: "media" (audio), "mark" (playback sync), "clear" (barge-in)
// Reference: https://developer.exotel.com/docs/agentstream/developer-guide

const axios = require('axios');
const {
  transcribeAudio: transcribeAudioRest,
  createSttSession,
  createTtsSession,
  keepAliveAgent,
} = require('./sarvamClient');
const {
  buildSystemPrompt,
  buildWelcomeGreeting,
  buildOutcomeExtractionPrompt,
  buildDefaultSystemPrompt,
  buildDefaultWelcomeGreeting,
} = require('./promptBuilder');
const { buildMemoryBlock } = require('./conversationMemory');
const { applyAiCallOutcome, applyNoConnectOutcome } = require('./outcomeService');
const { markForTransfer } = require('./transferState');
const Lead = require('../../models/Lead');

// ─── Config ─────────────────────────────────────────────────────────────────

// VAD: treat consecutive silent frames as end-of-speech. Trimmed from 30 to
// 20 frames (~600ms -> ~400ms) — this is pure dead time before we even
// start processing a turn, and 400ms is still safely above normal
// mid-sentence pause lengths.
const SILENCE_FRAME_THRESHOLD = 20;
const SILENCE_RMS_CUTOFF = 400;

// Exotel requires audio chunks to be multiples of 320 bytes.
// 1600 bytes = 5 × 320 = 100ms at 8kHz mono PCM16.
const EXOTEL_FRAME_BYTES = 1600;
const FRAME_MS = 100;

// How long to wait for the streaming-STT transcript to arrive before
// falling back to a REST call on the locally buffered segment.
const STT_WAIT_MS = 400;

// Cap on how much conversation history gets sent to the LLM each turn.
const MAX_HISTORY_MESSAGES = 12;

const END_CALL_MARKER = '[[END_CALL]]';
const TRANSFER_MARKER = '[[TRANSFER_TO_HR]]';
const MIN_CALL_DURATION_FOR_TRANSFER_MS = 3 * 60 * 1000;

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const AI_CALLER_MODEL = process.env.AI_CALLER_MODEL || 'gpt-4o-mini';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Streaming OpenAI call ────────────────────────────────────────────────
//
// Streams the reply and invokes onSentence(chunkText) as soon as each
// sentence-ish chunk is ready, instead of waiting for the full completion.
// Resolves with the full reply text once the stream ends (used for
// marker detection / transcript storage).
function streamAgentReply(messages, onSentence) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return reject(new Error('OPENAI_API_KEY is not configured'));

    let fullText = '';
    let sentenceBuf = '';
    let settled = false;

    const maybeFlush = (force) => {
      if (!sentenceBuf.trim()) { sentenceBuf = ''; return; }
      const hasBoundary = /[.!?](\s|$)/.test(sentenceBuf);
      if (force || hasBoundary || sentenceBuf.length > 120) {
        const chunk = sentenceBuf;
        sentenceBuf = '';
        onSentence(chunk.trim());
      }
    };

    axios
      .post(
        OPENAI_API_URL,
        { model: AI_CALLER_MODEL, messages, temperature: 0.6, max_tokens: 80, stream: true },
        {
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          httpsAgent: keepAliveAgent,
          timeout: 12000,
          responseType: 'stream',
        }
      )
      .then((response) => {
        const stream = response.data;
        let buffer = '';

        stream.on('data', (raw) => {
          buffer += raw.toString('utf8');
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const json = JSON.parse(payload);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                sentenceBuf += delta;
                maybeFlush(false);
              }
            } catch {
              // partial JSON split across chunks — ignore, next data event completes it
            }
          }
        });

        stream.on('end', () => {
          if (settled) return;
          settled = true;
          maybeFlush(true);
          resolve(fullText.trim() || 'Sorry, could you say that again?');
        });

        stream.on('error', (err) => {
          if (settled) return;
          settled = true;
          reject(err);
        });
      })
      .catch(reject);
  });
}

async function getCallOutcome(outcomeExtractionPrompt, transcriptMessages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: AI_CALLER_MODEL,
        messages: [outcomeExtractionPrompt, ...transcriptMessages],
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        httpsAgent: keepAliveAgent,
        timeout: 20000,
      }
    );
    const raw = (response.data?.choices?.[0]?.message?.content || '').trim();
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
    let sample = pcm16Chunk.readInt16LE(i * 2);
    sum += sample * sample;
  }
  return Math.sqrt(sum / len);
}

// ─── Speech text sanitizer ──────────────────────────────────────────────────
function sanitizeForSpeech(text) {
  if (!text) return '';
  let s = text;
  s = s.replace(/^#{1,6}\s*/gm, '');
  s = s.replace(/\*\*(.*?)\*\*/g, '$1');
  s = s.replace(/__(.*?)__/g, '$1');
  s = s.replace(/\*(.*?)\*/g, '$1');
  s = s.replace(/_(.*?)_/g, '$1');
  s = s.replace(/```[\s\S]*?```/g, ' ');
  s = s.replace(/`([^`]*)`/g, '$1');
  s = s.replace(/^\s*[-*•]\s+/gm, '');
  s = s.replace(/^\s*\d+\.\s+/gm, '');
  s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function stripMarkers(text) {
  return text.replace(END_CALL_MARKER, '').replace(TRANSFER_MARKER, '').trim();
}

function speakText(session, text) {
  const clean = sanitizeForSpeech(stripMarkers(text));
  if (!clean || !session.ttsSession) return;
  session.ttsSession.speak(clean);
}

// ─── Playback queue — paces Sarvam audio chunks out to Exotel at realtime ───
// Persists for the whole call so consecutive speak() calls (sentence chunks
// of one reply, or back-to-back replies) just keep feeding the same queue.
function createPlaybackQueue(ws, session) {
  let pending = Buffer.alloc(0);
  let draining = false;

  async function drain() {
    if (draining) return;
    draining = true;
    try {
      while (pending.length >= EXOTEL_FRAME_BYTES) {
        if (session.abortSpeaking) { pending = Buffer.alloc(0); break; }
        const frame = pending.slice(0, EXOTEL_FRAME_BYTES);
        pending = pending.slice(EXOTEL_FRAME_BYTES);
        ws.send(JSON.stringify({
          event: 'media',
          stream_sid: session.streamSid,
          media: { payload: frame.toString('base64') },
        }));
        await sleep(FRAME_MS);
      }
    } finally {
      draining = false;
    }
  }

  function push(chunk) {
    if (session.abortSpeaking) return;
    pending = Buffer.concat([pending, chunk]);
    drain();
  }

  function flushRemainder() {
    if (pending.length > 0 && !session.abortSpeaking) {
      const rem = pending.length % 320;
      let frame = pending;
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
    pending = Buffer.alloc(0);
  }

  function clear() {
    pending = Buffer.alloc(0);
  }

  function hasPending() {
    return draining || pending.length > 0;
  }

  return { push, clear, flushRemainder, hasPending };
}

// Resolves once the playback queue has been quiet (no new audio chunks and
// nothing buffered) for `quietMs` — i.e. the agent has actually finished
// speaking this reply, across however many sentence chunks it took.
async function waitForPlaybackIdle(session, { quietMs = 300, timeoutMs = 10000 } = {}) {
  const start = Date.now();
  await sleep(150); // grace period for the first chunk to start arriving
  while (!session.abortSpeaking) {
    const quietFor = Date.now() - session.lastAudioChunkAt;
    const timedOut = Date.now() - start > timeoutMs;
    if (timedOut || (!session.playbackQueue.hasPending() && quietFor >= quietMs)) break;
    await sleep(50);
  }
  session.playbackQueue.flushRemainder();
  if (!session.abortSpeaking && session.streamSid) {
    session.ws.send(JSON.stringify({
      event: 'mark',
      stream_sid: session.streamSid,
      mark: { name: `reply-${Date.now()}` },
    }));
  }
  session.agentSpeaking = false;
}

// Bounded wait for the streaming-STT transcript to arrive after local VAD
// fires, before falling back to REST STT on the buffered segment.
async function waitForTranscript(session, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (session.pendingTranscripts.length > 0) {
      const text = session.pendingTranscripts.join(' ').trim();
      session.pendingTranscripts = [];
      return text;
    }
    await sleep(30);
  }
  return '';
}

function trimHistory(conversation) {
  const system = conversation.find((m) => m.role === 'system');
  const rest = conversation.filter((m) => m.role !== 'system');
  const trimmed = rest.length > MAX_HISTORY_MESSAGES ? rest.slice(-MAX_HISTORY_MESSAGES) : rest;
  return system ? [system, ...trimmed] : trimmed;
}

// ─── Speech segment processing ────────────────────────────────────────────────

async function processSpeechSegment(ws, session, pcm16Bytes) {
  // Transcript is usually already sitting ready from the continuous
  // streaming-STT session (Sarvam's own VAD finalizes it independently).
  let text = session.pendingTranscripts.join(' ').trim();
  session.pendingTranscripts = [];

  if (!text) text = await waitForTranscript(session, STT_WAIT_MS);

  if (!text) {
    try {
      const langCode = session.language === 'English' ? 'en-IN' : 'te-IN';
      text = await transcribeAudioRest(Buffer.from(pcm16Bytes), langCode);
    } catch (err) {
      console.error(`[orchestrator] STT fallback failed (${session.callSid}):`, err.message);
    }
  }
  if (!text) return false;

  console.log(`[orchestrator] STT (${session.callSid}): "${text}"`);
  session.conversation.push({ role: 'user', content: text });

  const trimmedMessages = trimHistory(session.conversation);

  let fullReply = '';
  session.agentSpeaking = true;
  session.abortSpeaking = false;
  try {
    fullReply = await streamAgentReply(trimmedMessages, (chunk) => {
      if (!session.abortSpeaking) speakText(session, chunk);
    });
  } catch (err) {
    console.error(`[orchestrator] GPT failed (${session.callSid}):`, err.message);
    fullReply = 'ఒక్క నిమిషం, మళ్ళీ చెప్పగలరా?';
    if (!session.abortSpeaking) speakText(session, fullReply);
  }

  const shouldEnd = fullReply.includes(END_CALL_MARKER);
  const wantsTransfer = fullReply.includes(TRANSFER_MARKER);
  const spokenReply = stripMarkers(fullReply);

  if (wantsTransfer) session.studentInterested = true;

  const elapsedMs = Date.now() - session.startedAt;
  const shouldTransferNow =
    session.studentInterested &&
    !session.transferPending &&
    elapsedMs >= MIN_CALL_DURATION_FOR_TRANSFER_MS;

  console.log(
    `[orchestrator] GPT (${session.callSid}): "${spokenReply}"` +
    `${shouldEnd ? ' [END]' : ''}${wantsTransfer ? ' [INTERESTED]' : ''}${shouldTransferNow ? ' [TRANSFER-NOW]' : ''}`
  );
  session.conversation.push({ role: 'assistant', content: spokenReply });

  await waitForPlaybackIdle(session);

  if (shouldTransferNow) {
    session.transferPending = true;
    const handoffLine = session.language === 'English'
      ? 'Sure, please hold — connecting you to my colleague now.'
      : 'సరే sir, ఒక్క నిమిషం hold చేయండి, మా HR మేడమ్ కి కనెక్ట్ చేస్తున్నాను.';
    speakText(session, handoffLine);
    await waitForPlaybackIdle(session);
    return 'transfer';
  }

  return shouldEnd;
}

// ─── Call end — save outcome to MongoDB directly ─────────────────────────────

async function finalizeCall(session, { transferredToHr = false } = {}) {
  if (session.sttSession) session.sttSession.close();
  if (session.ttsSession) session.ttsSession.close();

  const durationSeconds = Math.floor((Date.now() - session.startedAt) / 1000);
  const hadConversation = session.conversation.some((m) => m.role === 'user');

  console.log(`[orchestrator] finalizing call ${session.callSid} (${durationSeconds}s, spoke: ${hadConversation})`);

  if (!session.leadId || !hadConversation) {
    if (session.leadId) {
      await Lead.updateOne({ _id: session.leadId }, { aiCallState: 'completed' }).catch(() => {});
    }
    return;
  }

  const transcriptMessages = session.conversation.filter((m) => m.role !== 'system');
  const transcriptText = transcriptMessages
    .map((m) => `${m.role === 'user' ? 'Student' : 'Agent'}: ${m.content}`)
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
      transferredToHr,
    }).catch((err) => console.error('[orchestrator] applyAiCallOutcome failed:', err.message));
  }
}

// ─── Main WebSocket handler ───────────────────────────────────────────────────

async function handleCall(ws, req) {
  const url = new URL(req.url, 'http://localhost');
  const leadId = url.searchParams.get('leadId') || url.searchParams.get('leadid');
  const campaignId = url.searchParams.get('campaignId') || url.searchParams.get('campaignid');

  console.log(`[orchestrator] new connection leadId=${leadId}`);

  const session = {
    ws,
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
    busy: false,
    abortSpeaking: false,
    studentInterested: false,
    transferPending: false,
    pendingTranscripts: [],
    lastAudioChunkAt: Date.now(),
    sttSession: null,
    ttsSession: null,
  };
  session.playbackQueue = createPlaybackQueue(ws, session);

  const contextPromise = (async () => {
    let lead = null;
    if (leadId) {
      try {
        lead = await Lead.findById(leadId).populate('courseInterest', 'name');
      } catch (err) {
        console.error('[orchestrator] failed to load lead:', err.message);
      }
    }

    if (lead) {
      const memoryBlock = await buildMemoryBlock(leadId).catch(() => '');
      return {
        language: lead.language || 'Telugu',
        systemPrompt: buildSystemPrompt(lead, memoryBlock),
        greeting: buildWelcomeGreeting(lead),
      };
    }

    if (leadId) console.warn(`[orchestrator] leadId=${leadId} did not resolve to a lead — using default prompt`);
    return {
      language: 'Telugu',
      systemPrompt: buildDefaultSystemPrompt(),
      greeting: buildDefaultWelcomeGreeting(),
    };
  })();

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

      const params = start.custom_parameters || {};
      if (params.leadId) session.leadId = params.leadId;
      if (params.campaignId) session.campaignId = params.campaignId;

      if (!session.leadId && session.callSid) {
        try {
          const byCallSid = await Lead.findOne({ activeCallSid: session.callSid }).select('_id campaign');
          if (byCallSid) {
            session.leadId = byCallSid._id.toString();
            session.campaignId = session.campaignId || (byCallSid.campaign ? byCallSid.campaign.toString() : null);
          }
        } catch (err) {
          console.error('[orchestrator] CallSid lead lookup failed:', err.message);
        }
      }

      console.log(`[orchestrator] call started: ${session.callSid} lead=${session.leadId}`);

      const ctx = await contextPromise;
      session.language = ctx.language;
      session.conversation = [{ role: 'system', content: ctx.systemPrompt }];
      session.outcomeExtractionPrompt = buildOutcomeExtractionPrompt();

      const langCode = session.language === 'English' ? 'en-IN' : 'te-IN';

      // One STT socket and one TTS socket for the whole call — opened once,
      // reused across every turn.
      session.sttSession = createSttSession({ languageCode: langCode });
      session.sttSession.on('transcript', (text) => session.pendingTranscripts.push(text));
      session.sttSession.on('error', (err) =>
        console.error(`[orchestrator] stt session error (${session.callSid}):`, err.message));

      session.ttsSession = createTtsSession({
        languageCode: langCode,
        onAudioChunk: (buf) => {
          session.lastAudioChunkAt = Date.now();
          session.playbackQueue.push(buf);
        },
      });

      session.busy = true;
      session.conversation.push({ role: 'assistant', content: ctx.greeting });
      session.agentSpeaking = true;
      session.abortSpeaking = false;
      try {
        speakText(session, ctx.greeting);
        await waitForPlaybackIdle(session);
      } catch (err) {
        console.error('[orchestrator] welcome TTS failed:', err.message);
      } finally {
        session.busy = false;
      }

    } else if (event === 'media') {
      const payload = message.media?.payload;
      if (!payload) return;

      const chunk = Buffer.from(payload, 'base64');

      // Feed the continuous streaming-STT session regardless of turn state,
      // so the transcript is ready by the time local VAD fires.
      if (session.sttSession) session.sttSession.sendAudio(chunk);

      const chunkRms = chunk.length >= 2 ? rms(chunk) : 0;
      const isSilent = chunkRms < SILENCE_RMS_CUTOFF;

      if (!isSilent && session.agentSpeaking) {
        ws.send(JSON.stringify({ event: 'clear', stream_sid: session.streamSid }));
        session.agentSpeaking = false;
        session.abortSpeaking = true;
        session.playbackQueue.clear();
        if (session.ttsSession) session.ttsSession.abort(); // no server-side cancel; close + lazily reconnect next speak()
      }

      session.audioBuffer = Buffer.concat([session.audioBuffer, chunk]);
      session.silenceRun = isSilent ? session.silenceRun + 1 : 0;

      if (
        !session.busy &&
        session.silenceRun >= SILENCE_FRAME_THRESHOLD &&
        session.audioBuffer.length > 0
      ) {
        const segment = Buffer.from(session.audioBuffer);
        session.audioBuffer = Buffer.alloc(0);
        session.silenceRun = 0;
        session.busy = true;

        let outcome = false;
        try {
          outcome = await Promise.race([
            processSpeechSegment(ws, session, segment),
            new Promise((resolve) => setTimeout(() => resolve(false), 12000)),
          ]);
        } catch (err) {
          console.error('[orchestrator] processSpeechSegment error:', err.message);
        } finally {
          session.busy = false;
        }

        if (outcome === 'transfer') {
          markForTransfer(session.callSid);
          await finalizeCall(session, { transferredToHr: true });
          ws.close();
        } else if (outcome) {
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
    if (session.conversation.some((m) => m.role === 'user')) {
      finalizeCall(session).catch(() => {});
    }
  });

  ws.on('error', (err) => {
    console.error(`[orchestrator] WS error (${session.callSid}):`, err.message);
  });
}

module.exports = { handleCall };