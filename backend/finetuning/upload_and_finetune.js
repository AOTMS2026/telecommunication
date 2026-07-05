// telecommunication/backend/finetuning/upload_and_finetune.js
//
// MIGRATED FROM OPENAI TO GEMINI — OpenAI's self-serve fine-tuning was blocked
// on this account, so this now creates a Gemini supervised-tuning job via the
// Gemini API's tunedModels.create endpoint (generativelanguage.googleapis.com),
// authenticated with a plain GEMINI_API_KEY. This is the Google AI Studio
// tuning route — it does NOT require a GCP project, billing, Cloud Storage
// bucket, or Vertex AI service account (that's the *separate*, heavier Vertex
// AI SFT route). Docs: https://ai.google.dev/gemini-api/docs/model-tuning
//
// FORMAT DIFFERENCE FROM OPENAI: OpenAI's fine-tuning file format is
// multi-turn {"messages": [{role, content}, ...]} per line — train.jsonl and
// val.jsonl (built by build_finetune_data.py) are still in that format, since
// that script is the versioned source of truth for the call transcripts.
// Gemini's tuning API instead wants single-turn {textInput, output} examples,
// so this script explodes each multi-turn call transcript into one example
// per assistant turn: textInput is the system prompt + conversation so far,
// output is that turn's assistant reply. No changes needed to
// build_finetune_data.py or the .jsonl files themselves.
//
// NOTE: unlike the old OpenAI script, this tuning API takes training examples
// inline in the request body — there's no separate file-upload step, and (as
// of writing) no inline validation-set parameter on this endpoint, so
// val.jsonl isn't sent to the tuning job; use it to manually eval the
// resulting tunedModels/<id> afterward instead.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const TRAIN_PATH = path.join(__dirname, 'data', 'train.jsonl');
const VAL_PATH = path.join(__dirname, 'data', 'val.jsonl');

// gemini-1.5-flash-001-tuning is Google's dedicated tuning-enabled base model
// for the API-key (non-Vertex) tuning route.
const BASE_MODEL = process.env.FINETUNE_BASE_MODEL || 'models/gemini-1.5-flash-001-tuning';
const TUNED_MODEL_ID = (process.env.TUNED_MODEL_ID || `aotms-counselor-${Date.now()}`)
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, '-')
  .slice(0, 40);
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

/**
 * Converts one OpenAI-style {messages:[{role,content},...]} multi-turn call
 * transcript into multiple Gemini {textInput, output} single-turn examples —
 * one per assistant turn, with all prior turns folded into textInput as
 * context so the tuned model still learns to use conversation history.
 */
function explodeToGeminiExamples(messagesObj) {
  const { messages } = messagesObj;
  const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
  const turns = messages.filter(m => m.role !== 'system');

  // Merge back-to-back same-role messages (a few transcripts have two
  // consecutive assistant lines for one logical turn) before splitting.
  const merged = [];
  for (const m of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) {
      last.content += '\n' + m.content;
    } else {
      merged.push({ role: m.role, content: m.content });
    }
  }

  const examples = [];
  const history = [];
  for (const turn of merged) {
    if (turn.role === 'assistant') {
      const historyText = history
        .map(h => `${h.role === 'assistant' ? 'Counselor' : 'Caller'}: ${h.content}`)
        .join('\n');
      const textInput = historyText
        ? `${systemPrompt}\n\nConversation so far:\n${historyText}\n\nCounselor:`
        : `${systemPrompt}\n\nCounselor (opening line):`;
      examples.push({ textInput, output: turn.content });
    }
    history.push(turn);
  }
  return examples;
}

function buildExamples(filePath) {
  const rows = readJsonl(filePath);
  return rows.flatMap(explodeToGeminiExamples);
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Missing GEMINI_API_KEY env var.');
    process.exit(1);
  }

  const trainExamples = buildExamples(TRAIN_PATH);
  console.log(`Exploded train.jsonl into ${trainExamples.length} single-turn Gemini training examples.`);

  if (fs.existsSync(VAL_PATH)) {
    const valExamples = buildExamples(VAL_PATH);
    console.log(`(val.jsonl has ${valExamples.length} examples — not submitted to the job; use it to manually eval the tuned model afterward.)`);
  }

  const body = {
    displayName: TUNED_MODEL_ID,
    baseModel: BASE_MODEL,
    tuningTask: {
      trainingData: {
        examples: {
          examples: trainExamples,
        },
      },
      // hyperparameters (epochCount, batchSize, learningRate) are optional —
      // omit them to use Google's recommended defaults for this dataset size.
    },
  };

  try {
    const response = await axios.post(
      `${API_BASE}/tunedModels?tunedModelId=${encodeURIComponent(TUNED_MODEL_ID)}`,
      body,
      { headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' } }
    );
    console.log('Tuning job created:', response.data.name || response.data.metadata?.tunedModel || TUNED_MODEL_ID);
    console.log(JSON.stringify(response.data, null, 2));
    console.log(
      `\nPoll GET ${API_BASE}/tunedModels/${TUNED_MODEL_ID} (header: x-goog-api-key: <your key>) ` +
      `until state is ACTIVE, then set AI_CALLER_MODEL=tunedModels/${TUNED_MODEL_ID} in backend/.env ` +
      `to use it for live calls (see orchestrator.js).`
    );
  } catch (err) {
    console.error('Fine-tune job creation failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

main();