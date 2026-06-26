// backend/src/services/aiCaller/promptBuilder.js
//
// UPDATED for the RunPod + GPT-4.1-mini migration:
//  - buildSystemPrompt() now accepts an optional `memoryBlock` (from
//    conversationMemory.js) and supports Telugu/English/Hinglish per lead.language.
//  - buildWelcomeGreeting() unchanged in spirit, language-aware.
//  - NEW: buildOutcomeExtractionPrompt() — moved here (from the old
//    openrouterClient.js) so the prompt template stays versioned in this repo;
//    the RunPod orchestrator fetches it via GET /api/ai-caller/prompt/:leadId
//    rather than duplicating prompt text on the pod.

function languageInstruction(lead) {
  switch (lead.language) {
    case 'English':
      return 'Speak in English.';
    case 'Hinglish':
      return 'Speak in natural Hinglish (mixed Hindi-English), the way a real Indian counselor would on a phone call.';
    case 'Telugu':
    default:
      // Default to Telugu — per the current customer base (Telugu-only),
      // rather than guessing/mirroring. Natural code-mixing with English
      // course/program names is expected and fine (matches how the
      // Telugu-finetuned STT/TTS models on RunPod are set up — see
      // runpod/orchestrator/stt.py and tts.py).
      return 'Speak in Telugu, switching to English naturally for technical course/program names, the way a real Telugu speaker does on a phone call.';
  }
}

/**
 * Builds the initial system prompt for a call, personalized with lead details.
 * `memoryBlock` (optional) comes from conversationMemory.buildMemoryBlock() and
 * is injected so callback calls continue naturally instead of restarting cold.
 */
function buildSystemPrompt(lead, memoryBlock = '') {
  const studentName = lead.name || 'there';
  const course = lead.courseInterest?.name || lead.preferredCourses?.[0] || 'our courses';
  const location = lead.location ? ` from ${lead.location}` : '';

  return `You are Priya, a friendly course counselor calling from AOTMS (a learning platform) on a phone call.
You are speaking with ${studentName}${location}, who showed interest in: ${course}.

${languageInstruction(lead)}

${memoryBlock ? `Context from previous conversations with this student:\n${memoryBlock}\n` : ''}
Your goals on this call:
1. Greet them warmly and confirm it's a good time to talk for 1-2 minutes.
2. ${memoryBlock ? 'Continue naturally from where you left off last time — do not restart from scratch.' : `Ask if they're still interested in ${course}.`}
3. Briefly answer questions about the course (duration, mode, fees) in general, friendly terms.
4. Ask contextual follow-up questions and handle objections naturally — don't sound scripted or robotic.
5. If interested, try to schedule a demo/callback and ask for a convenient day/time.
6. If not interested, politely thank them and end the call.

Classify the student's intent as you go (for your own internal tracking, do not say these labels aloud):
Interested, Highly Interested, Need More Information, Demo Requested, Fee Inquiry,
Parent Discussion Required, Call Later, Busy, Already Joined, Wrong Number, Not Interested.

Rules:
- Keep every reply SHORT (1-2 sentences) — this is a real-time voice call.
- Speak naturally, like a human counselor, not like a script.
- Do not mention you are an AI unless directly and explicitly asked.
- If the student wants to end the call, politely say goodbye.`;
}

function buildWelcomeGreeting(lead) {
  const studentName = lead.name ? lead.name.split(' ')[0] : 'మిత్రమా';
  if (lead.language === 'English') {
    return `Hi ${studentName}, this is Priya calling from AOTMS regarding the course you enquired about. Is this a good time to talk for a minute?`;
  }
  // Default: Telugu — matches the Telugu-only customer base and the
  // Telugu-finetuned STT/TTS models in runpod/orchestrator/.
  return `Namaskaram ${studentName}, idi Priya, AOTMS nundi. Meeru inquire chesina course gurinchi maatladalanukunta, ippudu maatladagalama?`;
}

/**
 * Structured end-of-call extraction prompt. Returns a system message that, when
 * sent to GPT-4.1-mini along with the full call transcript, produces ONLY a raw
 * JSON object matching the extended outcome schema consumed by outcomeService.js.
 *
 * Moved here (was inline in services/aiCaller/openrouterClient.js for the old
 * OpenRouter flow) so it is one versioned source of truth that both the legacy
 * path and the new RunPod orchestrator (via GET /api/ai-caller/prompt/:leadId)
 * read from.
 */
function buildOutcomeExtractionPrompt() {
  return {
    role: 'system',
    content: `You just finished a phone call as an AOTMS course counselor. Based on the conversation transcript below, output ONLY a raw JSON object (no markdown, no code fences, no extra text) with these exact keys:
{
  "leadStatus": one of ["Fresh","Connected","Call Not Responding","Call Back Later","Not interested","Demo Scheduled","Demo Done","Won","Lost","Blocked"],
  "interestLevel": one of ["Highly Interested","Interested","Need More Information","Not Interested","Unknown"],
  "studentIntent": one of ["demo_requested","fee_inquiry","parent_discussion_required","call_later","busy","already_joined","wrong_number","not_interested","general_interest"],
  "followUpRequired": boolean,
  "followUpDate": an ISO 8601 date string if a callback time was agreed, or null,
  "demoRequired": boolean,
  "callbackReason": "short phrase describing why a callback was requested, or empty string",
  "conversationSummary": "1-2 sentence summary of what the student said and the outcome",
  "nextRecommendedAction": one of ["schedule_demo","send_fee_details","callback_later","mark_converted","mark_invalid","close_lost","no_action"],
  "confidenceScore": a number between 0 and 1 indicating how confident you are in this extraction
}
Pick "leadStatus" based on what actually happened. If unsure, use "Connected".`,
  };
}

module.exports = { buildSystemPrompt, buildWelcomeGreeting, buildOutcomeExtractionPrompt };
