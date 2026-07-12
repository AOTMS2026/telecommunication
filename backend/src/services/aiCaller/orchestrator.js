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
//
// LATENCY FIX (this pass): GPT replies were previously fetched in one
// blocking, non-streamed call — nothing was sent to TTS until the ENTIRE
// reply had finished generating, on top of STT time. That "silent" GPT
// generation was the single biggest remaining source of dead air, mid-call
// lag, and turn-to-turn inconsistency (varies with OpenAI queueing).
// Fixed by streaming tokens from OpenAI and flushing each completed
// sentence straight into TTS as soon as it's ready, so playback starts
// after the FIRST sentence instead of the WHOLE reply. Also added an
// AbortController per turn so barge-in / turn-timeout actually cancels the
// in-flight STT/GPT/TTS network calls instead of letting them run to
// completion in the background (which was causing overlapping audio and
// "random" pauses when a stale turn's TTS landed after a new one started).

const axios = require('axios');
const OpenAI = require('openai');
const { transcribeAudio, synthesizeSpeech } = require('./sarvamClient');
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

// VAD: treat ≥30 consecutive ~20ms silent frames (~600ms) as end of speech.
// Exotel sends 8kHz PCM16 frames; silence = RMS near 0.
const SILENCE_FRAME_THRESHOLD = 30;
const SILENCE_RMS_CUTOFF = 400;

// Exotel requires audio chunks to be multiples of 320 bytes.
// 1600 bytes = 5 × 320 = 100ms at 8kHz mono PCM16.
const EXOTEL_FRAME_BYTES = 1600;

// Marker GPT inserts when it wants to end the call naturally.
const END_CALL_MARKER = '[[END_CALL]]';

// Marker GPT inserts when the student shows genuine interest and should be
// handed off to a human (HR) instead of the AI continuing to burn credits.
const TRANSFER_MARKER = '[[TRANSFER_TO_HR]]';

// Only transfer once the call has run at least this long — an AI call that
// converts in under 3 minutes is cheaper to just let the AI finish/schedule
// than to also spend a human's time on it this early.
const MIN_CALL_DURATION_FOR_TRANSFER_MS = 3 * 60 * 1000;

// Hard ceiling for one full STT→GPT→TTS turn. If exceeded, the turn is
// aborted (network calls cancelled via AbortController, not just abandoned)
// so a stale reply can never land on top of the next turn's audio.
const TURN_TIMEOUT_MS = 12000;

// ─── OpenAI client ──────────────────────────────────────────────────────────
//
// SWITCHED FROM GEMINI: the Gemini API key expired, so live-call generation
// and outcome extraction now go through OpenAI's Chat Completions API.
// messages/session.conversation are already in OpenAI's native
// {role: 'system'|'user'|'assistant', content}[] shape, so no payload
// conversion is needed here.
//
// AI_CALLER_MODEL defaults to gpt-4o-mini (OpenAI's fast/cheap "mini" model,
// good fit for low-latency voice-call turns). Override via env var if needed.
const AI_CALLER_MODEL = process.env.AI_CALLER_MODEL || 'gpt-4o-mini';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'; // used by getCallOutcome only

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Pull complete sentences out of a growing token buffer so each one can be
// sent to TTS the instant it's ready, without ever splitting inside an
// END_CALL_MARKER / TRANSFER_MARKER token (which can arrive split across
// multiple streamed chunks).
function extractCompleteSentences(buffer) {
  const openIdx = buffer.lastIndexOf('[[');
  const closeIdx = buffer.lastIndexOf(']]');
  const safeEnd = openIdx > closeIdx ? openIdx : buffer.length;
  const safePart = buffer.slice(0, safeEnd);
  const rest = buffer.slice(safeEnd);

  const matches = safePart.match(/[^.!?।]+[.!?।]+/g);
  if (!matches) return { sentences: [], remainder: buffer };

  const consumedLength = matches.join('').length;
  const remainder = safePart.slice(consumedLength) + rest;
  return { sentences: matches.map((s) => s.trim()).filter(Boolean), remainder };
}

/**
 * Streams the GPT reply token-by-token. Calls `onSentence` as soon as each
 * complete sentence is available (well before the full reply is done),
 * and returns the full assembled reply text once the stream ends.
 */
async function streamAgentReply(messages, { onSentence, signal } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const stream = await openai.chat.completions.create(
    {
      model: AI_CALLER_MODEL,
      messages,
      temperature: 0.6,
      max_tokens: 80, // hard backstop for "1-2 sentence" replies
      stream: true,
    },
    { signal }
  );

  let buffer = '';
  let full = '';

  for await (const chunk of stream) {
    if (signal?.aborted) break;
    const delta = chunk.choices?.[0]?.delta?.content || '';
    if (!delta) continue;
    full += delta;
    buffer += delta;

    const { sentences, remainder } = extractCompleteSentences(buffer);
    buffer = remainder;
    for (const sentence of sentences) {
      if (onSentence) await onSentence(sentence);
    }
  }

  if (!signal?.aborted && buffer.trim() && onSentence) {
    await onSentence(buffer.trim());
  }

  return full.trim() || 'Sorry, could you say that again?';
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
        response_format: { type: 'json_object' }, // OpenAI JSON mode — no markdown fences to strip
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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
    // Read signed int16 little-endian
    let sample = pcm16Chunk.readInt16LE(i * 2);
    sum += sample * sample;
  }
  return Math.sqrt(sum / len);
}

// ─── Speech text sanitizer ──────────────────────────────────────────────────
//
// Safety net for Sarvam's "Text must contain at least one character from the
// allowed languages" 422. GPT is instructed (see promptBuilder.js) not to
// produce markdown/emoji, but LLMs slip occasionally — and Sarvam's WS
// buffers/splits long text internally (min_buffer_size/max_chunk_length),
// so even one stray "**" or "😊" can land in its own chunk with no actual
// letters in it and get rejected. Strip anything that isn't speakable
// BEFORE it reaches synthesizeSpeech(), rather than trying to catch it after
// Sarvam has already rejected it mid-call.
function sanitizeForSpeech(text) {
  if (!text) return '';
  let s = text;

  // Markdown headers: "### Heading" -> "Heading"
  s = s.replace(/^#{1,6}\s*/gm, '');
  // Bold/italic markers: **text**, __text__, *text*, _text_ -> text
  s = s.replace(/\*\*(.*?)\*\*/g, '$1');
  s = s.replace(/__(.*?)__/g, '$1');
  s = s.replace(/\*(.*?)\*/g, '$1');
  s = s.replace(/_(.*?)_/g, '$1');
  // Code: fenced blocks and inline backticks -> plain text
  s = s.replace(/```[\s\S]*?```/g, ' ');
  s = s.replace(/`([^`]*)`/g, '$1');
  // List markers: "- item", "* item", "1. item" -> "item"
  s = s.replace(/^\s*[-*•]\s+/gm, '');
  s = s.replace(/^\s*\d+\.\s+/gm, '');
  // Emojis and other pictographic symbols
  s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '');
  // Collapse whitespace/newlines from the above removals into single spaces
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

// ─── Send TTS audio to Exotel ────────────────────────────────────────────────

async function sendTts(ws, session, text, signal = null) {
  const clean = sanitizeForSpeech(text);
  if (!clean) return;
  if (signal?.aborted) return;

  const langCode = session.language === 'English' ? 'en-IN'
    : (session.language === 'Hindi' || session.language === 'Hinglish') ? 'hi-IN'
    : 'te-IN';

  session.agentSpeaking = true;
  session.abortSpeaking = false;

  // STREAMING PLAYBACK: audio bytes are forwarded to Exotel via `drain()`
  // the moment enough of them have arrived (see onChunk callback below),
  // while Sarvam is still synthesizing the rest of the sentence in the
  // background — instead of waiting for the full clip before any audio
  // is heard.
  let pending = Buffer.alloc(0);
  let synthesisDone = false;
  let draining = false;
  const FRAME_MS = 100; // EXOTEL_FRAME_BYTES (1600) = 100ms of 8kHz/16-bit mono audio

  const drain = async () => {
    if (draining) return; // a drain loop is already running — it will pick up newly appended bytes
    draining = true;
    try {
      while (!session.abortSpeaking && !signal?.aborted) {
        if (pending.length >= EXOTEL_FRAME_BYTES) {
          const frame = pending.slice(0, EXOTEL_FRAME_BYTES);
          pending = pending.slice(EXOTEL_FRAME_BYTES);
          ws.send(JSON.stringify({
            event: 'media',
            stream_sid: session.streamSid,
            media: { payload: frame.toString('base64') },
          }));
          await new Promise(resolve => setTimeout(resolve, FRAME_MS));
        } else if (synthesisDone) {
          // No full frame left, and Sarvam is done — flush the remainder
          // padded to a 320-byte boundary (Exotel's requirement) and stop.
          if (pending.length > 0) {
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
            pending = Buffer.alloc(0);
          }
          break;
        } else {
          // Not enough buffered for a full frame yet, and Sarvam hasn't
          // finished — wait briefly for more chunks to arrive.
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      }
    } finally {
      draining = false;
    }
  };

  try {
    await synthesizeSpeech(clean, langCode, (chunk) => {
      if (session.abortSpeaking || signal?.aborted) return;
      pending = Buffer.concat([pending, chunk]);
      drain(); // fire-and-forget; re-entrancy-safe via the `draining` flag
    }, { signal });
  } catch (err) {
    if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
      console.error(`[orchestrator] TTS failed (${session.callSid}):`, err.message);
    }
    session.agentSpeaking = false;
    session.abortSpeaking = false;
    return;
  }

  synthesisDone = true;
  // Let the drain loop flush whatever's still buffered.
  while ((draining || pending.length > 0) && !session.abortSpeaking && !signal?.aborted) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }

  if (!session.abortSpeaking && !signal?.aborted) {
    // Mark signals end of this utterance (for barge-in re-arming)
    ws.send(JSON.stringify({
      event: 'mark',
      stream_sid: session.streamSid,
      mark: { name: `reply-${Date.now()}` },
    }));
  }

  session.agentSpeaking = false;
  session.abortSpeaking = false;
}

// ─── Speech segment processing ────────────────────────────────────────────────

async function processSpeechSegment(ws, session, pcm16Bytes) {
  const controller = new AbortController();
  session.currentAbort = controller;

  // STT
  let text;
  try {
    text = await transcribeAudio(Buffer.from(pcm16Bytes), { signal: controller.signal });
  } catch (err) {
    if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
      console.error(`[orchestrator] STT failed (${session.callSid}):`, err.message);
    }
    return false;
  }
  if (!text) return false;

  console.log(`[orchestrator] STT (${session.callSid}): "${text}"`);
  session.conversation.push({ role: 'user', content: text });

  // Sentences must be spoken in the order GPT produced them — queue each
  // sendTts call behind the previous one instead of firing them in parallel.
  let ttsQueue = Promise.resolve();
  const speak = (sentence) => {
    ttsQueue = ttsQueue.then(() => sendTts(ws, session, sentence, controller.signal));
    return ttsQueue;
  };

  // GPT (OpenAI) — streamed, sentence-chunked straight into TTS
  let reply;
  try {
    reply = await streamAgentReply(session.conversation, {
      signal: controller.signal,
      onSentence: (sentence) => {
        const spoken = sentence.replace(END_CALL_MARKER, '').replace(TRANSFER_MARKER, '').trim();
        if (spoken) speak(spoken);
      },
    });
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'CanceledError') {
      session.currentAbort = null;
      return false;
    }
    console.error(`[orchestrator] GPT failed (${session.callSid}):`, err.message);
    reply = 'ఒక్క నిమిషం, మళ్ళీ చెప్పగలరా?';
    speak(reply);
  }

  await ttsQueue.catch(err => console.error(`[orchestrator] sendTts failed (${session.callSid}):`, err.message));
  session.currentAbort = null;

  const shouldEnd = reply.includes(END_CALL_MARKER);
  const wantsTransfer = reply.includes(TRANSFER_MARKER);
  const spokenReply = reply.replace(END_CALL_MARKER, '').replace(TRANSFER_MARKER, '').trim();

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

  if (shouldTransferNow) {
    session.transferPending = true;
    // Short handoff line so the caller isn't just cut off mid-conversation.
    const handoffLine = session.language === 'English'
      ? 'Sure, please hold — connecting you to my colleague now.'
      : 'సరే sir, ఒక్క నిమిషం hold చేయండి, మా HR మేడమ్ కి కనెక్ట్ చేస్తున్నాను.';
    try {
      await sendTts(ws, session, handoffLine);
    } catch (err) {
      console.error(`[orchestrator] handoff TTS failed (${session.callSid}):`, err.message);
    }
    return 'transfer';
  }

  return shouldEnd;
}

// ─── Call end — save outcome to MongoDB directly ─────────────────────────────

async function finalizeCall(session, { transferredToHr = false } = {}) {
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
      transferredToHr,
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
    busy: false,          // true while an STT→GPT→TTS turn is in flight — gates new turns
    abortSpeaking: false, // set by barge-in to stop an in-progress TTS playback loop early
    currentAbort: null,   // AbortController for the in-flight STT/GPT/TTS network calls of this turn
    studentInterested: false, // set once GPT emits TRANSFER_MARKER at any point in the call
    transferPending: false,   // set once the handoff has actually been triggered (guards against double-trigger)
  };

  // Kick off lead/context loading in the BACKGROUND — do not await it here.
  // Previously this was awaited before ws.on('message', ...) was even
  // registered, meaning a slow DB lookup sat in the critical path before we
  // could receive Exotel's 'connected'/'start' events at all, adding to
  // "AI doesn't start the conversation immediately" delay (and, in the
  // worst case, risking those early events arriving before any listener
  // existed). Now the listener is attached immediately below, and the
  // 'start' handler just awaits this promise — which by then has usually
  // already resolved during Exotel's own connection handshake time.
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

      // Override leadId/campaignId from custom_parameters if Exotel sends them
      const params = start.custom_parameters || {};
      if (params.leadId) session.leadId = params.leadId;
      if (params.campaignId) session.campaignId = params.campaignId;

      // Final fallback: resolve via CallSid if leadId is still unknown
      // (belt-and-suspenders alongside the /stream-url CallSid lookup —
      // covers any Exotel App Bazaar config that skips that step).
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

      // Apply lead context (resolved in the background above — usually
      // already done by the time 'start' arrives, since it ran in parallel
      // with Exotel's own connection handshake) and greet immediately.
      const ctx = await contextPromise;
      session.language = ctx.language;
      session.conversation = [{ role: 'system', content: ctx.systemPrompt }];
      session.outcomeExtractionPrompt = buildOutcomeExtractionPrompt();

      session.busy = true;
      session.conversation.push({ role: 'assistant', content: ctx.greeting });
      try {
        await sendTts(ws, session, ctx.greeting);
      } catch (err) {
        console.error('[orchestrator] welcome TTS failed:', err.message);
      } finally {
        session.busy = false;
      }

    } else if (event === 'media') {
      const payload = message.media?.payload;
      if (!payload) return;

      const chunk = Buffer.from(payload, 'base64');

      // Barge-in: if agent is speaking and caller starts talking, clear queued
      // audio AND cancel whatever STT/GPT/TTS network calls are still in
      // flight for that turn — otherwise a stale reply can land audibly on
      // top of the next turn once it starts.
      const chunkRms = chunk.length >= 2 ? rms(chunk) : 0;
      const isSilent = chunkRms < SILENCE_RMS_CUTOFF;

      if (!isSilent && session.agentSpeaking) {
        ws.send(JSON.stringify({ event: 'clear', stream_sid: session.streamSid }));
        session.agentSpeaking = false;
        session.abortSpeaking = true; // tell the in-progress sendTts frame loop to stop early
        session.currentAbort?.abort();
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
        session.busy = true; // block any other segment from being cut/processed until this turn finishes

        let outcome = false;
        try {
          outcome = await Promise.race([
            processSpeechSegment(ws, session, segment),
            new Promise(resolve => setTimeout(() => {
              // Turn overran its budget — cancel the in-flight network calls
              // so this turn's audio/state can never land after the next one
              // starts, instead of just abandoning the promise.
              session.currentAbort?.abort();
              resolve(false);
            }, TURN_TIMEOUT_MS)),
          ]);
        } catch (err) {
          console.error('[orchestrator] processSpeechSegment error:', err.message);
        } finally {
          session.busy = false;
          session.currentAbort = null;
        }

        if (outcome === 'transfer') {
          // Mark the handoff BEFORE closing the socket — Exotel's Passthru
          // applet (configured right after the Voicebot applet) will hit
          // /api/ai-caller/passthru within seconds of the WS closing, and
          // that route reads this same in-memory flag to route the call
          // into the Connect applet that dials HR.
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
    session.currentAbort?.abort();
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
