const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

// Transcribes an audio file on disk using OpenAI's Whisper API
// (whisper-1, /v1/audio/transcriptions). Used to turn manually-uploaded
// call recordings (no transcript stored at upload time) into text so the
// existing Call-IQ agent pipeline (services/callIqService.js) can analyze
// them exactly like it already does for AI-dialer calls.
async function transcribeAudioFile(absolutePath, apiKey) {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) throw new Error('No OpenAI API key configured for transcription');
  if (!fs.existsSync(absolutePath)) throw new Error('Recording file not found on disk');

  const form = new FormData();
  form.append('file', fs.createReadStream(absolutePath));
  form.append('model', 'whisper-1');
  form.append('response_format', 'text');

  const res = await axios.post(
    'https://api.openai.com/v1/audio/transcriptions',
    form,
    {
      headers: { Authorization: `Bearer ${key}`, ...form.getHeaders() },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 120000,
    }
  );

  // response_format: 'text' returns a raw string body
  return typeof res.data === 'string' ? res.data.trim() : (res.data?.text || '').trim();
}

module.exports = { transcribeAudioFile };