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
const { transcribeAudio, createTtsSession } = require('./sarvamClient');
const { getSarvamClient, AI_CALLER_CHAT_MODEL } = require('./sarvamChatClient');
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
const EXOTEL_FRAME_BYTES = 320; // 20ms of 8kHz/16-bit mono audio — matches Exotel's own inbound frame size

// Marker GPT inserts when it wants to end the call naturally.
const END_CALL_MARKER = '[[END_CALL]]';

// Marker GPT inserts when the student shows genuine interest and should be
// handed off to a human (HR) instead of the AI continuing to burn credits.
const TRANSFER_MARKER = '[[TRANSFER_TO_HR]]';

// Only transfer once the call has run at least this long — an AI call that
// converts in under 3 minutes is cheaper to just let the AI finish/schedule
// than to also spend a human's time on it this early.
const MIN_CALL_DURATION_FOR_TRANSFER_MS = 3 * 60 * 1000;

// STALL detection: abort a turn only if NO progress (no STT result, no new
// GPT sentence, no new TTS audio chunk) has happened for this long — i.e. a
// genuine hang. This replaced a flat 12s ceiling on the WHOLE turn
// (STT+GPT+full TTS playback), which was aborting perfectly healthy,
// still-speaking multi-sentence replies mid-sentence: a normal 2-3 sentence
// Telugu reply legitimately takes longer than 12s to fully speak once you
// include STT + GPT latency too, so the old timeout was cutting Sara off
// mid-word and then playing an apology on top of her own unfinished reply
// — that abrupt cut/overlap is exactly what sounded like "voice stuck/
// breaking mid-call".
const STALL_TIMEOUT_MS = 12000;
// Absolute safety-net ceiling regardless of activity, in case progress
// updates themselves ever stop firing correctly — should essentially never
// trigger in normal operation.
const ABSOLUTE_TURN_CEILING_MS = 45000;

// DEAD-AIR / NO-RESPONSE HANDLING: this is different from SILENCE_RECOVERY_ENGINE
// (which is a prompt-level behavior that only ever runs mid-turn, i.e. AFTER
// the caller has already said something at least once). If the caller never
// speaks at all — picks up and says nothing, or goes fully silent after the
// agent's line and never responds again — no STT segment is ever cut (see
// `if (!hadSpeech) return;` below), so the LLM is never even invoked and
// nothing in the prompt can react. These two timers are a code-level
// safety net for exactly that case: total silence with zero caller speech.
// Measured from the end of the agent's last utterance (or the opening
// greeting), not reset by anything except the caller actually speaking.
const SILENCE_CHECKIN_MS = 10000; // 10s of total silence -> Sara checks in once ("Hello sir, are you there?")
const SILENCE_HANGUP_MS = 30000; // 30s of total silence (including the check-in) -> end the call gracefully

// BUG FIX: a single non-silent frame while the agent was speaking was
// treated as barge-in — but with no echo cancellation on the line, the
// agent's OWN voice bleeding back into the mic (or a stray click/line
// blip) trips that instantly. That's what the logs showed: "GPT failed:
// Request was aborted" firing repeatedly turn after turn, killing replies
// before they even finished generating. Require a short run of consecutive
// non-silent frames before treating it as a real interruption.
const BARGE_IN_FRAME_THRESHOLD = 10; // ~200ms sustained — was 5 (~100ms), too easily tripped by line echo
const MIN_SPEAKING_MS_BEFORE_BARGEIN = 700; // was 400 — echo is worst right as Sara starts talking
// Barge-in must be clearly louder than plain end-of-speech silence detection,
// not just "not silent" — line echo of Sara's own voice often sits only
// slightly above SILENCE_RMS_CUTOFF, which was enough to falsely trigger
// barge-in and cut her off mid-sentence with no real interruption happening.
const BARGE_IN_RMS_CUTOFF = 900;

// BUG FIX: after any STT failure (esp. 429 rate-limit), briefly stop
// cutting/sending new segments instead of immediately retrying — the old
// code had no backoff at all, so once Sarvam started rate-limiting, every
// subsequent silence-triggered segment got fired immediately and failed
// too, producing the 18-in-a-row 429 storm seen in production logs.
const STT_COOLDOWN_ERROR_MS = 800;
const STT_COOLDOWN_RATE_LIMIT_MS = 2500;

// BUG FIX: a 402 (Sarvam account balance/credits exhausted) or any other
// STT failure was retried forever — every subsequent segment just failed
// again the same way, so the caller heard "sorry, could not hear that"
// on a loop until they hung up (seen in production logs: 402 repeated
// 6+ times back to back). These failures are not transient like a single
// dropped packet — once the account has no balance, every future call in
// the same window will fail identically. Cap consecutive STT failures and
// end the call gracefully instead of burning the rest of it on dead loops.
const MAX_CONSECUTIVE_STT_FAILURES = 3;

// BUG FIX: GPT (esp. the smaller sarvam-30b model) sometimes gets stuck and
// outputs the EXACT SAME reply turn after turn regardless of what the
// caller actually said next — seen verbatim in production logs, repeating
// the same sentence 10+ times while the caller asked different questions
// each time. Detect this and break the loop instead of letting it repeat
// indefinitely and never actually answering the caller.
const MAX_CONSECUTIVE_REPEATED_REPLIES = 2;

// Maps our internal language names to Sarvam's language codes. Pulled out
// so both TTS-session creation and sendTts agree on the code.
function resolveLangCode(language) {
  if (language === 'English') return 'en-IN';
  if (language === 'Hindi' || language === 'Hinglish') return 'hi-IN';
  return 'te-IN';
}

// BUG FIX ("voice stuck / replies make no sense mid-call"): the carrier/
// telecom stack can play its OWN system announcements into the call audio
// (e.g. a hold announcement if the call gets put on hold somewhere in the
// SIP/PSTN path) — Sarvam then transcribes that announcement as if the
// caller had said it, and GPT generates a reply to it, which is nonsense
// and burns a wasted turn. Recognize the common announcement phrasing
// (Telugu/Hindi/English) and treat it as noise, not real caller speech.
const CARRIER_ANNOUNCEMENT_PATTERNS = [
  /హోల్డ్\s*లో\s*పెట్టార/,          // Telugu: "...put your call on hold..."
  /లైన్\s*లో\s*వేచి\s*ఉండ/,          // Telugu: "...please wait on the line..."
  /హోల్డ్\s*పర్\s*రక్క/,             // Hindi (Telugu-script transliteration): "...held your call on hold..."
  /లైన్\s*పర్\s*బనే\s*రహ/,           // Hindi (Telugu-script transliteration): "...stay on the line..."
  /please\s+(hold|wait)\s+(on\s+)?the\s+line/i,
  /call\s+(has\s+been\s+|is\s+)?(put\s+)?on\s+hold/i,
];

function isCarrierAnnouncement(text) {
  return CARRIER_ANNOUNCEMENT_PATTERNS.some((re) => re.test(text));
}

// BUG FIX (root cause of "not transferring even after 3 min"): the ONLY
// thing that ever sets session.studentInterested = true is the LLM itself
// choosing to emit the [[TRANSFER_TO_HR]] marker in its reply. Seen in
// production logs: the caller said, in effect, "I want to take the
// 10,000-rupee course" — clear enrollment agreement — but the LLM just
// kept asking "which time for the demo?" and never emitted the marker, so
// studentInterested stayed false for the entire rest of the (252s) call.
// The 3-minute gate in processSpeechSegment was working correctly the
// whole time; it simply never had anything to open, because nothing ever
// flips this flag if the model forgets to. This is a deterministic,
// keyword-based backstop on the caller's OWN transcribed words — it does
// not replace the LLM's marker, it just guarantees the flag still gets
// set even on a turn where the model doesn't produce the marker.
const ENROLLMENT_INTENT_PATTERNS = [
  /తీసుకోవాలనుకుంటున్నాను/, // Telugu: "I want to take (it)"
  /తీసుకుంటాను/,             // Telugu: "I will take (it)"
  /చేరుతాను/,                 // Telugu: "I will join"
  /జాయిన్\s*అవుతాను/,         // Telugu: "I will join" (English loanword)
  /join\s*(avutha|chestha|karunga|kartha hoon|karta hoon)/i,
  /\bi\s*(want|would like)\s*to\s*(join|enroll|take)\b/i,
  /\bi\s*will\s*join\b/i,
  /\byes\s*i\s*(will|want to)\s*(join|enroll)\b/i,
];

function hasEnrollmentIntent(text) {
  return ENROLLMENT_INTENT_PATTERNS.some((re) => re.test(text));
}

// Detects whether the caller opened the call with some form of "hello"
// (English/Telugu/Hindi) so the opening greeting can mirror it ("Hello sir,
// I am Sara...") instead of always using the plain default ("Hi sir, I am
// Sara..." / "Namaskaram..."), which is used when no speech (or no "hello")
// is heard within OPENING_GREETING_WAIT_MS.
const HELLO_OPENING_PATTERN = /\b(hello|hallo|halo)\b|హలో|హాయ్|हेलो|हैलो|हलो/i;

// Max time to wait for the caller's opening word before greeting anyway
// with the default (non-"hello") variant, so the call never stalls in
// silence if the caller doesn't say anything.
const OPENING_GREETING_WAIT_MS = 4000;

// ─── Sarvam LLM client ──────────────────────────────────────────────────────
//
// SWITCHED FROM GEMINI: the Gemini API key expired, so live-call generation
// and outcome extraction now go through Sarvam's Chat Completions API
// (OpenAI-compatible endpoint, see sarvamChatClient.js). messages/
// session.conversation are already in the {role: 'system'|'user'|'assistant',
// content}[] shape Sarvam expects, so no payload conversion is needed here.
//
// AI_CALLER_MODEL defaults to sarvam-105b (see sarvamChatClient.js) — set
// AI_CALLER_CHAT_MODEL=sarvam-30b for faster/cheaper replies if needed.
const AI_CALLER_MODEL = AI_CALLER_CHAT_MODEL;
const SARVAM_CHAT_URL = 'https://api.sarvam.ai/v1/chat/completions'; // used by getCallOutcome only

const sarvamChat = getSarvamClient();

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
 * Streams the Sarvam LLM reply token-by-token. Calls `onSentence` as soon as each
 * complete sentence is available (well before the full reply is done),
 * and returns the full assembled reply text once the stream ends.
 */
async function streamAgentReply(messages, { onSentence, signal } = {}) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) throw new Error('SARVAM_API_KEY is not configured');

  const stream = await sarvamChat.chat.completions.create(
    {
      model: AI_CALLER_MODEL,
      messages,
      temperature: 0.6,
      max_tokens: 220, // was 160 — still clipping longer native-Telugu-script replies mid-sentence; raised further as a safety net alongside the tightened 1-2 sentence / 35-word cap now enforced in the prompt itself
      reasoning_effort: null, // disable Sarvam's "thinking" mode — we need fast conversational replies, not reasoning tokens eating the latency budget
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
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await axios.post(
      SARVAM_CHAT_URL,
      {
        model: AI_CALLER_MODEL,
        messages: [outcomeExtractionPrompt, ...transcriptMessages],
        temperature: 0.2,
        max_tokens: 300,
        reasoning_effort: null,
        response_format: { type: 'json_object' }, // JSON mode — no markdown fences to strip
      },
      {
        headers: { 'api-subscription-key': apiKey, 'Content-Type': 'application/json' },
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
  if (!session.ttsSession) return; // safety net, should always be set in 'start' handler

  session.agentSpeaking = true;
  session.speakingStartedAt = Date.now();
  session.abortSpeaking = false;

  // STREAMING PLAYBACK: audio bytes are forwarded to Exotel via `drain()`
  // the moment enough of them have arrived (see onChunk callback below),
  // while Sarvam is still synthesizing the rest of the sentence in the
  // background — instead of waiting for the full clip before any audio
  // is heard.
  let pending = Buffer.alloc(0);
  let synthesisDone = false;
  let draining = false;
  // BUG FIX ("voice breaking/crashing mid-sentence" even when GPT's text
  // was clean end-to-end): audio was previously sent in large 100ms/1600-byte
  // chunks, sleeping 100ms between each. Real telephony media streaming
  // (Exotel/Twilio-style) sends and expects small ~20ms frames — our own
  // inbound audio from the caller already arrives in that size. Bundling
  // outbound audio into much bigger 100ms blocks meant that ANY single
  // Node event-loop delay (a webhook GET, a GC pause, a DB call) turned
  // into a full 100ms audible gap in the middle of a sentence. Matching
  // the smaller native frame size means the same jitter only ever costs
  // ~20ms — far below what a listener perceives as a "break" or "crash".
  const FRAME_MS = 20;
  // BUG FIX: sequential `sleep(20ms)` between frames accumulates drift —
  // any single delay (a slow GC pause, the event loop handling one of the
  // periodic /api/notifications polls, network jitter) pushes EVERY
  // subsequent frame in that utterance late by the same amount, since each
  // wait is measured from "now" rather than from a fixed schedule. On a
  // long reply this compounds, and Exotel's playback buffer eventually
  // starves — heard as the voice breaking up, worse toward the end of
  // longer sentences. Scheduling against an absolute per-utterance clock
  // (frame N fires at streamStartedAt + N*20ms, not "20ms after the last
  // one") makes each frame self-correct instead of drifting further behind.
  const streamStartedAt = Date.now();
  let frameIndex = 0;
  const waitForNextFrameSlot = () => {
    const targetTime = streamStartedAt + frameIndex * FRAME_MS;
    frameIndex += 1;
    const delay = Math.max(0, targetTime - Date.now());
    return new Promise(resolve => setTimeout(resolve, delay));
  };

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
          await waitForNextFrameSlot();
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
    await session.ttsSession.speak(clean, (chunk) => {
      if (session.abortSpeaking || signal?.aborted) return;
      session.lastActivityAt = Date.now(); // audio still arriving — real progress, not a hang
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

// ─── Dead-air / no-response monitor ─────────────────────────────────────────
//
// Call this every time the agent finishes speaking and it becomes the
// caller's turn to respond (end of opening greeting, end of a normal reply,
// end of an apology/timeout line that doesn't end the call). Restarts the
// 30s total-silence window from zero.
function markAgentTurnEnded(session) {
  session.lastAgentTurnEndAt = Date.now();
  session.callerRespondedSinceAgentTurn = false;
  session.silenceCheckInSent = false;
}

// Runs once/sec for the life of the call. Independent of the STT/GPT/TTS
// turn pipeline entirely — this is the only thing watching for a caller who
// never says anything at all.
function startSilenceMonitor(ws, session) {
  session.silenceMonitorInterval = setInterval(async () => {
    if (session.finalized) {
      clearInterval(session.silenceMonitorInterval);
      return;
    }
    // Don't act mid-turn, mid-greeting-wait, or while Sara is already talking —
    // only fire while it's genuinely the caller's turn and nothing is happening.
    if (session.awaitingGreeting || session.busy || session.agentSpeaking) return;
    if (!session.lastAgentTurnEndAt) return; // greeting hasn't completed yet
    if (session.callerRespondedSinceAgentTurn) return; // caller has spoken since — nothing to do

    const silentFor = Date.now() - session.lastAgentTurnEndAt;

    if (silentFor >= SILENCE_HANGUP_MS && session.silenceCheckInSent) {
      clearInterval(session.silenceMonitorInterval);
      session.busy = true;
      const goodbye = session.language === 'English'
        ? "Okay sir, I am not able to hear you — I will call back later. Thank you!"
        : 'సరే సార్, మీ వాయిస్ వినిపించడం లేదు, నేను తర్వాత మళ్ళీ కాల్ చేస్తాను. ధన్యవాదాలు!';
      try { await sendTts(ws, session, goodbye); } catch (err) {
        console.error(`[orchestrator] no-response hangup TTS failed (${session.callSid}):`, err.message);
      }
      await finalizeCall(session);
      ws.close();
      return;
    }

    if (silentFor >= SILENCE_CHECKIN_MS && !session.silenceCheckInSent) {
      session.silenceCheckInSent = true;
      session.busy = true;
      const checkIn = session.language === 'English'
        ? 'Hello sir, are you there?'
        : 'హలో సార్, వినిపిస్తుందా?';
      try { await sendTts(ws, session, checkIn); } catch (err) {
        console.error(`[orchestrator] silence check-in TTS failed (${session.callSid}):`, err.message);
      }
      session.busy = false;
    }
  }, 1000);
}

// ─── Opening greeting (hello-aware) ─────────────────────────────────────────
//
// Sends the correct opening greeting variant exactly once: "Hello sir, I am
// Sara..." if the caller's very first utterance sounded like "hello", or the
// plain default ("Hi sir, I am Sara..." / "Namaskaram...") if the caller
// said something else, said nothing, or the wait window timed out.
async function sendOpeningGreeting(ws, session, openedWithHello) {
  if (!session.awaitingGreeting) return; // already sent — guards against double-send
  session.awaitingGreeting = false;
  clearTimeout(session.greetingTimeout);

  const greeting = openedWithHello ? session.greetingHello : session.greetingNormal;
  session.conversation.push({ role: 'assistant', content: greeting });
  // BUG FIX ("cold start"/repeated greeting): the "never repeat your
  // greeting" rule lives inside a long system prompt, and the model was
  // ignoring it later in the call — re-saying the full intro line when the
  // caller just said "hello" again mid-conversation. A short, recent
  // reminder message is far more reliable than one instruction buried in a
  // wall of text, so pin it right after the greeting.
  session.conversation.push({
    role: 'system',
    content: 'Reminder: you already greeted the caller and introduced yourself as Sara from Academy of Tech Masters — do not say your name/company introduction again for the rest of this call, even if the caller says "hello" again or seems unclear. Just continue the conversation naturally from where it left off.',
  });

  session.busy = true;
  try {
    await sendTts(ws, session, greeting);
  } catch (err) {
    console.error(`[orchestrator] opening greeting TTS failed (${session.callSid}):`, err.message);
  } finally {
    session.busy = false;
    markAgentTurnEnded(session); // start the 30s dead-air window fresh from here
  }
}

// ─── Speech segment processing ────────────────────────────────────────────────

async function processSpeechSegment(ws, session, pcm16Bytes) {
  const controller = new AbortController();
  session.currentAbort = controller;
  session.lastActivityAt = Date.now(); // turn starting counts as activity

  // BUG FIX: this was hardcoded to Telugu regardless of the lead's actual
  // language, so English speech got transcribed as phonetic Telugu script
  // (e.g. "yeah can you tell me about your company" -> "యా కెన్ యు ప్లీజ్ టెల్ మీ
  // అబౌట్ యువర్ కంపెనీ"). GPT could usually still infer intent from the
  // phonetic spelling, but it's fragile. Use the session's resolved language.
  let text;
  try {
    text = await transcribeAudio(Buffer.from(pcm16Bytes), {
      signal: controller.signal,
      languageCode: resolveLangCode(session.language),
    });
    session.lastActivityAt = Date.now(); // STT result landed — real progress
  } catch (err) {
    if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
      console.error(`[orchestrator] STT failed (${session.callSid}):`, err.message);

      // BUG FIX: this used to just `return false` here with nothing spoken —
      // the caller heard pure dead air. Combined with no backoff, a single
      // Sarvam 429 would repeat on every subsequent segment (each one also
      // failing instantly), which is exactly the 18-in-a-row failure loop
      // in the logs that ended with the student hanging up. Now: back off
      // briefly, and actually tell the caller we didn't catch that.
      const isRateLimited = err.response?.status === 429;
      const isPaymentRequired = err.response?.status === 402;
      if (isPaymentRequired) {
        // 402 = Sarvam account has no balance/credits. Every subsequent
        // call will fail identically until credits are topped up — do not
        // treat this like ordinary transient noise.
        console.error(`[orchestrator] STT 402 (Sarvam credits exhausted) — call ${session.callSid}`);
      }
      session.sttCooldownUntil = Date.now() + (isRateLimited ? STT_COOLDOWN_RATE_LIMIT_MS : STT_COOLDOWN_ERROR_MS);
      session.sttFailureStreak = (session.sttFailureStreak || 0) + 1;

      if (session.sttFailureStreak >= MAX_CONSECUTIVE_STT_FAILURES) {
        // Stop looping the apology — end the call politely instead of
        // repeating a doomed retry until the caller gives up and hangs up.
        const giveUpLine = session.language === 'English'
          ? 'Sorry, there seems to be a network issue on my end. I will call you back shortly. Thank you!'
          : 'క్షమించండి సార్, నెట్‌వర్క్ సమస్య ఉన్నట్టుంది. నేను కొద్దిసేపట్లో మళ్ళీ కాల్ చేస్తాను. ధన్యవాదాలు!';
        try { await sendTts(ws, session, giveUpLine, controller.signal); } catch {}
        return true; // signals the caller loop to finalize + close the WS
      }

      const apology = session.language === 'English'
        ? 'Sorry, I could not hear that clearly. Could you say it again?'
        : 'క్షమించండి సార్, వినపడలేదు. మళ్ళీ చెప్పగలరా?';
      try { await sendTts(ws, session, apology, controller.signal); } catch {}
      markAgentTurnEnded(session); // call continues — restart the dead-air window
    }
    return false;
  }
  session.sttFailureStreak = 0; // reset once STT succeeds again
  if (!text) return false;

  // BUG FIX: call already ended (e.g. caller hung up) while this turn's STT
  // was still in flight — don't waste a GPT call generating a reply nobody
  // will ever hear, and don't clutter logs with a reply for a dead call.
  if (session.finalized) return false;

  // BUG FIX: don't treat the carrier's own hold/announcement audio as if
  // the caller said it — see CARRIER_ANNOUNCEMENT_PATTERNS comment above.
  if (isCarrierAnnouncement(text)) {
    console.log(`[orchestrator] ignoring carrier announcement, not caller speech (${session.callSid}): "${text}"`);
    return false;
  }

  console.log(`[orchestrator] STT (${session.callSid}): "${text}"`);
  session.conversation.push({ role: 'user', content: text });

  if (hasEnrollmentIntent(text)) {
    console.log(`[orchestrator] enrollment-intent keyword match (${session.callSid}) — flagging studentInterested`);
    session.studentInterested = true;
  }

  // Sentences must be spoken in the order the LLM produced them — queue each
  // sendTts call behind the previous one instead of firing them in parallel.
  let ttsQueue = Promise.resolve();
  const speak = (sentence) => {
    ttsQueue = ttsQueue.then(() => sendTts(ws, session, sentence, controller.signal));
    return ttsQueue;
  };

  // BUG FIX ("repeating sentences so many times"): the LLM occasionally
  // re-emits the exact same sentence more than once WITHIN a single
  // streamed reply (not just turn-to-turn). Since each sentence is spoken
  // the instant it's extracted, this used to play the duplicate straight
  // out loud. Track normalized sentences already spoken THIS turn and drop
  // repeats before they ever reach TTS.
  const spokenSentencesThisTurn = new Set();
  const normalizeSentence = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

  // Sarvam LLM — streamed, sentence-chunked straight into TTS
  let reply;
  try {
    reply = await streamAgentReply(session.conversation, {
      signal: controller.signal,
      onSentence: (sentence) => {
        session.lastActivityAt = Date.now(); // new sentence ready — real progress
        const spoken = sentence.replace(END_CALL_MARKER, '').replace(TRANSFER_MARKER, '').trim();
        if (!spoken) return;
        const normalized = normalizeSentence(spoken);
        if (normalized && spokenSentencesThisTurn.has(normalized)) {
          console.warn(`[orchestrator] dropping repeated sentence within same reply (${session.callSid}): "${spoken}"`);
          return;
        }
        if (normalized) spokenSentencesThisTurn.add(normalized);
        speak(spoken);
      },
    });
  } catch (err) {
    // BUG FIX (root cause of the "please repeat" loop on every barge-in):
    // the Sarvam/OpenAI-compatible SDK's own abort error does NOT set
    // err.name to 'AbortError' — it's literally just 'Error' with message
    // "Request was aborted." (confirmed against the installed SDK). So this
    // check never matched a real barge-in, and every single interruption
    // fell through to the "Sarvam LLM failed" branch below, logging a fake
    // error and forcing Sara to say "one moment, please repeat" even though
    // nothing failed — the caller had simply started talking. Checking the
    // abort signal itself is reliable regardless of what the SDK names its
    // error.
    if (controller.signal.aborted || err.name === 'AbortError' || err.name === 'CanceledError' || err?.constructor?.name === 'APIUserAbortError') {
      session.currentAbort = null;
      return false;
    }
    console.error(`[orchestrator] Sarvam LLM failed (${session.callSid}):`, err.message);
    reply = 'ఒక్క నిమిషం, మళ్ళీ చెప్పగలరా?';
    speak(reply);
  }

  // BUG FIX: the call can end WHILE GPT is still generating (STT finished
  // before hangup, GPT finished after) — this is exactly what produced a
  // "GPT: ..." log line appearing AFTER "WS closed" for a dead call. Bail
  // out quietly instead of queuing dead audio / logging a pointless reply.
  if (session.finalized) return false;

  await ttsQueue.catch(err => console.error(`[orchestrator] sendTts failed (${session.callSid}):`, err.message));
  session.currentAbort = null;
  markAgentTurnEnded(session); // restart the dead-air window now that it's the caller's turn again

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
    `[orchestrator] Sarvam LLM (${session.callSid}): "${spokenReply}"` +
    `${shouldEnd ? ' [END]' : ''}${wantsTransfer ? ' [INTERESTED]' : ''}${shouldTransferNow ? ' [TRANSFER-NOW]' : ''}`
  );
  session.conversation.push({ role: 'assistant', content: spokenReply });

  // BUG FIX (root cause of the "ignores the question, repeats itself"
  // loop in production logs): normalize + compare this reply to the last
  // one. If they match, the model is stuck — it already spoke this exact
  // sentence again despite the caller asking something new, so nudge it
  // hard for the NEXT turn, and if it's still stuck after that, stop
  // relying on the model entirely and close the call ourselves rather
  // than let it repeat forever.
  const normalize = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const normalizedReply = normalize(spokenReply);
  if (normalizedReply && normalizedReply === session.lastNormalizedReply) {
    session.repeatStreak = (session.repeatStreak || 0) + 1;
  } else {
    session.repeatStreak = 0;
  }
  session.lastNormalizedReply = normalizedReply;

  if (session.repeatStreak >= MAX_CONSECUTIVE_REPEATED_REPLIES) {
    // BUG FIX (seen in production): a caller who had ALREADY shown clear
    // enrollment interest (studentInterested=true) and was well past the
    // 3-minute mark got hard-closed by this loop safety-net with a generic
    // "our team will call you back" line instead of actually transferring
    // — even though a live human handoff was fully eligible right then.
    // Prefer transferring over closing whenever the call already qualifies.
    const loopElapsedMs = Date.now() - session.startedAt;
    if (session.studentInterested && !session.transferPending && loopElapsedMs >= MIN_CALL_DURATION_FOR_TRANSFER_MS) {
      console.warn(`[orchestrator] repeated-reply loop detected (${session.callSid}) — transferring instead of closing (studentInterested=true)`);
      session.transferPending = true;
      const handoffLine = session.language === 'English'
        ? 'Okay sir, I am transferring your call to my team now — they will speak with you.'
        : 'సరే sir, మీ కాల్ ని మా టీమ్ కి transfer చేస్తున్నాను, వాళ్ళు మీతో మాట్లాడతారు.';
      try { await sendTts(ws, session, handoffLine); } catch (err) {
        console.error(`[orchestrator] loop-bailout handoff TTS failed (${session.callSid}):`, err.message);
      }
      return 'transfer';
    }

    console.warn(`[orchestrator] repeated-reply loop detected (${session.callSid}) — force-closing call`);
    const bailoutLine = session.language === 'English'
      ? 'Sorry for the confusion, sir — I will have our team call you back shortly with the details. Thank you!'
      : 'క్షమించండి సార్, కొంచెం confusion అయింది. మా team మీకు షార్ట్‌గా తిరిగి call చేస్తారు. ధన్యవాదాలు!';
    try { await sendTts(ws, session, bailoutLine); } catch (err) {
      console.error(`[orchestrator] loop-bailout TTS failed (${session.callSid}):`, err.message);
    }
    return true;
  } else if (session.repeatStreak === MAX_CONSECUTIVE_REPEATED_REPLIES - 1) {
    // One repeat already happened — pin a strong corrective reminder so
    // the NEXT generation actually engages with what the caller said
    // instead of repeating itself a second time.
    session.conversation.push({
      role: 'system',
      content: 'Reminder: your last reply was IDENTICAL to the one before it, which is a mistake — the caller has been saying different things and you are not responding to them. Re-read the caller\'s most recent message carefully and answer THAT specifically, in different words. Do not repeat any previous reply verbatim.',
    });
  }

  if (shouldTransferNow) {
    session.transferPending = true;
    // Short handoff line so the caller isn't just cut off mid-conversation.
    const handoffLine = session.language === 'English'
      ? 'Okay sir, I am transferring your call to my team now — they will speak with you.'
      : 'సరే sir, మీ కాల్ ని మా టీమ్ కి transfer చేస్తున్నాను, వాళ్ళు మీతో మాట్లాడతారు.';
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
  if (session.finalized) return; // BUG FIX: was running twice per call (see call sites)
  session.finalized = true;

  session.ttsSession?.close(); // release the persistent Sarvam TTS connection for this call

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
    ttsSession: null,          // persistent per-call Sarvam TTS WebSocket (created once language is known)
    hadSpeechInSegment: false, // true once a non-silent frame lands in the current accumulating segment
    bargeInRun: 0,             // consecutive non-silent frames while agent is speaking (barge-in debounce)
    speakingStartedAt: 0,      // timestamp agent started current utterance (barge-in grace period)
    sttCooldownUntil: 0,       // timestamp; no new segments are cut/sent to STT before this
    lastActivityAt: 0,         // updated on every real turn-progress event; used for stall detection
    finalized: false,          // guards finalizeCall() against running twice per call
    sttFailureStreak: 0,       // consecutive STT failures (402/429/etc.) — caps the retry loop
    lastNormalizedReply: '',   // normalized text of the previous assistant reply — for loop detection
    repeatStreak: 0,           // consecutive identical replies — for loop detection
    awaitingGreeting: false,   // true until the opening greeting has been sent (hello-aware)
    greetingHello: '',         // greeting variant used if the caller opened with "hello"
    greetingNormal: '',        // default greeting variant (no "hello" heard / timeout)
    greetingTimeout: null,     // timer that force-sends the default greeting if caller stays silent
    lastAgentTurnEndAt: 0,     // timestamp Sara last finished speaking; 0 = greeting not done yet
    callerRespondedSinceAgentTurn: false, // true once real caller audio has landed since lastAgentTurnEndAt
    silenceCheckInSent: false, // true once "Hello sir, are you there?" has been spoken for this silence window
    silenceMonitorInterval: null, // setInterval handle for the total-silence/no-response watchdog
  };

  startSilenceMonitor(ws, session);

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
        greetingNormal: buildWelcomeGreeting(lead, false),
        greetingHello: buildWelcomeGreeting(lead, true),
      };
    }

    if (leadId) console.warn(`[orchestrator] leadId=${leadId} did not resolve to a lead — using default prompt`);
    return {
      language: 'Telugu',
      systemPrompt: buildDefaultSystemPrompt(),
      greetingNormal: buildDefaultWelcomeGreeting(false),
      greetingHello: buildDefaultWelcomeGreeting(true),
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

      // We assume 8kHz/16-bit/mono (Exotel's documented default) throughout
      // this file — for TTS output rate, the STT input, and frame-size math.
      // Log whatever Exotel actually negotiated so a silent mismatch (e.g.
      // if the Voicebot Applet's WSS URL is ever changed to append
      // ?sample-rate=16000) shows up immediately instead of just sounding
      // like unexplained audio distortion.
      if (start.media_format) {
        console.log(`[orchestrator] Exotel media_format: ${JSON.stringify(start.media_format)}`);
      }

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
      // One TTS WebSocket for the whole call instead of one per sentence —
      // see sarvamClient.createTtsSession for why this was a latency bug.
      session.ttsSession = createTtsSession(resolveLangCode(session.language));

      // Don't speak immediately — wait briefly to hear how the caller opens
      // the call (e.g. "Hello?") so the greeting can mirror it ("Hello sir,
      // I am Sara...") instead of always barging in with a flat default
      // line. If the caller says nothing within OPENING_GREETING_WAIT_MS,
      // greet anyway with the plain default variant so the call never
      // stalls in silence.
      session.greetingHello = ctx.greetingHello;
      session.greetingNormal = ctx.greetingNormal;
      session.awaitingGreeting = true;
      session.busy = false;
      session.greetingTimeout = setTimeout(() => {
        sendOpeningGreeting(ws, session, false).catch(err =>
          console.error(`[orchestrator] greeting-timeout send failed (${session.callSid}):`, err.message)
        );
      }, OPENING_GREETING_WAIT_MS);

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
      const isLoudEnoughForBargeIn = chunkRms >= BARGE_IN_RMS_CUTOFF;

      // Barge-in debounce: require a longer run of consecutive CLEARLY LOUD
      // frames (not just barely-non-silent) before treating it as a real
      // interruption — see BARGE_IN_FRAME_THRESHOLD/BARGE_IN_RMS_CUTOFF
      // comments for why (line echo of Sara's own voice was tripping this).
      if (isSilent) {
        session.bargeInRun = 0;
      } else {
        session.hadSpeechInSegment = true;
        session.callerRespondedSinceAgentTurn = true; // real audio from the caller — cancels the dead-air timers
        if (session.agentSpeaking) {
          session.bargeInRun = isLoudEnoughForBargeIn ? session.bargeInRun + 1 : 0;
        }
      }

      if (
        session.agentSpeaking &&
        session.bargeInRun >= BARGE_IN_FRAME_THRESHOLD &&
        Date.now() - (session.speakingStartedAt || 0) >= MIN_SPEAKING_MS_BEFORE_BARGEIN
      ) {
        ws.send(JSON.stringify({ event: 'clear', stream_sid: session.streamSid }));
        session.agentSpeaking = false;
        session.abortSpeaking = true; // tell the in-progress sendTts frame loop to stop early
        session.currentAbort?.abort();
        session.bargeInRun = 0;
      }

      session.audioBuffer = Buffer.concat([session.audioBuffer, chunk]);
      session.silenceRun = isSilent ? session.silenceRun + 1 : 0;

      if (
        !session.busy &&
        session.silenceRun >= SILENCE_FRAME_THRESHOLD &&
        session.audioBuffer.length > 0 &&
        Date.now() >= session.sttCooldownUntil // still backing off after a recent STT error
      ) {
        const segment = Buffer.from(session.audioBuffer);
        const hadSpeech = session.hadSpeechInSegment;
        session.audioBuffer = Buffer.alloc(0);
        session.silenceRun = 0;
        session.hadSpeechInSegment = false;

        // BUG FIX (root cause of the 429 storm): previously ANY accumulated
        // buffer — even pure silence/line-noise/echo with no real speech —
        // got cut and sent to Sarvam STT the instant the silence timer
        // elapsed. During the ~1-2s the agent was busy processing a turn,
        // silent frames kept piling up the silenceRun counter, so the very
        // next tick after "busy" cleared would immediately re-trigger on a
        // near-empty segment, over and over, with zero gap between calls —
        // that's what hammered Sarvam into the 429 rate-limit loop in the
        // logs. Skip segments that never actually contained speech.
        if (!hadSpeech) return;

        if (session.awaitingGreeting) {
          session.busy = true;
          let openedWithHello = false;
          try {
            const openingText = await transcribeAudio(segment, {
              languageCode: resolveLangCode(session.language),
            });
            openedWithHello = HELLO_OPENING_PATTERN.test(openingText || '');
          } catch (err) {
            console.error(`[orchestrator] opening-greeting STT failed (${session.callSid}):`, err.message);
          }
          await sendOpeningGreeting(ws, session, openedWithHello);
          session.busy = false;
          return;
        }

        session.busy = true; // block any other segment from being cut/processed until this turn finishes

        let outcome = false;
        try {
          outcome = await new Promise((resolve, reject) => {
            let settled = false;
            const turnStartedAt = Date.now();

            const stallChecker = setInterval(() => {
              if (settled) return;
              const idleFor = Date.now() - session.lastActivityAt;
              const totalFor = Date.now() - turnStartedAt;
              if (idleFor >= STALL_TIMEOUT_MS || totalFor >= ABSOLUTE_TURN_CEILING_MS) {
                settled = true;
                clearInterval(stallChecker);
                // Genuinely stuck (or, as a last resort, the absolute
                // ceiling) — cancel the in-flight network calls so this
                // turn's audio/state can never land after the next one
                // starts, instead of just abandoning the promise.
                session.currentAbort?.abort();
                resolve('timeout');
              }
            }, 500);

            processSpeechSegment(ws, session, segment).then((result) => {
              if (settled) return;
              settled = true;
              clearInterval(stallChecker);
              resolve(result);
            }).catch((err) => {
              if (settled) return;
              settled = true;
              clearInterval(stallChecker);
              reject(err);
            });
          });
        } catch (err) {
          console.error('[orchestrator] processSpeechSegment error:', err.message);
        } finally {
          session.busy = false;
          session.currentAbort = null;
        }

        if (outcome === 'timeout') {
          // BUG FIX: previously this just silently ate the turn — caller's
          // question got transcribed (visible in STT logs) but never got a
          // reply at all, not even an apology, because this branch didn't
          // exist. It read as "I asked something and got total silence."
          console.warn(`[orchestrator] turn timed out (${session.callSid}) — speaking fallback instead of dead air`);
          const apology = session.language === 'English'
            ? 'Sorry, that took a moment. Could you say that again?'
            : 'క్షమించండి సార్, కొద్దిగా ఆలస్యం అయింది. మళ్ళీ చెప్పగలరా?';
          try { await sendTts(ws, session, apology); } catch (err) {
            console.error(`[orchestrator] timeout-fallback TTS failed (${session.callSid}):`, err.message);
          }
          markAgentTurnEnded(session); // call continues — restart the dead-air window
          outcome = false;
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
    clearTimeout(session.greetingTimeout);
    clearInterval(session.silenceMonitorInterval);
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