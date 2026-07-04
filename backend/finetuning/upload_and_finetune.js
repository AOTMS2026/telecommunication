// telecommunication/backend/finetuning/upload_and_finetune.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TRAIN_PATH = path.join(__dirname, 'data', 'train.jsonl');
const VAL_PATH = path.join(__dirname, 'data', 'val.jsonl');
const BASE_MODEL = process.env.FINETUNE_BASE_MODEL || 'gpt-4.1-mini-2025-04-14';

async function uploadFile(filePath) {
  const file = await client.files.create({
    file: fs.createReadStream(filePath),
    purpose: 'fine-tune',
  });
  console.log(`Uploaded ${filePath} -> ${file.id}`);
  return file.id;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY env var.');
    process.exit(1);
  }

  const trainFileId = await uploadFile(TRAIN_PATH);
  const valFileId = await uploadFile(VAL_PATH);

  const job = await client.fineTuning.jobs.create({
    training_file: trainFileId,
    validation_file: valFileId,
    model: BASE_MODEL,
  });

  console.log('Fine-tune job created:', job.id);
  console.log(job);
}

main().catch((err) => {
  console.error('Fine-tune upload failed:', err);
  process.exit(1);
});