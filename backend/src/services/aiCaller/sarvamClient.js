// backend/src/services/aiCaller/sarvamClient.js
//
// STT: saaras:v3 model, sample_rate=8000, high_vad_sensitivity=true (confirmed working)
// TTS: bulbul:v3 model over WebSocket (wss://api.sarvam.ai/text-to-speech/ws?model=bulbul:v3).
//   Verified against Sarvam's live API docs (docs.sarvam.ai) — the original
//   PDF guide's TTS field names/values (sample_rate, output_audio_codec=pcm,
//   speaker=meera/anushka) were wrong or version-mismatched:
//     - config key is `speech_sample_rate`, not `sample_rate`
//     - output_audio_codec values are linear16/mulaw/alaw/opus/flac/aac/wav/mp3
//       ('pcm' is not a valid value — 'linear16' is the raw-PCM equivalent)
//     - speaker `shubh` is valid for bulbul:v3 (`anushka` is a bulbul:v2-only voice)
// Exotel sends raw PCM16 8kHz 16-bit (per PDF spec — NOT mulaw)

const axios = require('axios');
const FormData = require('form-data');
const WebSocket = require('ws');

const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';
const SARVAM_TTS_WS_URL = 'wss://api.sarvam.ai/text-to-speech/ws?model=bulbul:v3';

function getSarvamKey() {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error('SARVAM_API_KEY is not configured');
  return key;
}

// ─── WAV builder — wraps raw PCM16 8kHz from Exotel into WAV container ───────
function buildWavBuffer(pcm16Bytes, sampleRate = 8000, channels = 1, bitsPerSample = 16) {
  const dataSize = pcm16Bytes.length;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  Buffer.from(pcm16Bytes).copy(buf, 44);
  return buf;
}

function stripWavHeader(wavBuf) {
  let offset = 12;
  while (offset + 8 <= wavBuf.length) {
    const id = wavBuf.toString('ascii', offset, offset + 4);
    const size = wavBuf.readUInt32LE(offset + 4);
    if (id === 'data') return wavBuf.slice(offset + 8, offset + 8 + size);
    offset += 8 + size;
    if (size % 2 !== 0) offset++;
  }
  return wavBuf.slice(44);
}

// ─── STT ─────────────────────────────────────────────────────────────────────
// Per PDF: model=saaras:v3, sample_rate=8000, high_vad_sensitivity=true
async function transcribeAudio(pcm16Bytes) {
  if (!pcm16Bytes || pcm16Bytes.length < 320) return '';

  const key = getSarvamKey();
  const wavBuf = buildWavBuffer(pcm16Bytes, 8000, 1, 16);

  const form = new FormData();
  form.append('file', wavBuf, { filename: 'audio.wav', contentType: 'audio/wav' });
  form.append('language_code', 'te-IN');
  form.append('model', 'saaras:v3');         // per PDF: saaras:v3
  form.append('sample_rate', '8000');         // per PDF: must match Exotel 8kHz
  form.append('high_vad_sensitivity', 'true'); // per PDF: 0.5s silence boundary

  const response = await axios.post(SARVAM_STT_URL, form, {
    headers: { ...form.getHeaders(), 'api-subscription-key': key },
    timeout: 12000,
  });

  const transcript = (response.data.transcript || '').trim();
  if (transcript) console.log(`[sarvam-stt] "${transcript.slice(0, 80)}"`);
  return transcript;
}

// ─── TTS ─────────────────────────────────────────────────────────────────────
// Per PDF: WebSocket wss://api.sarvam.ai/text-to-speech/ws?model=bulbul:v3
// config payload: { type: "config", data: { target_language_code, speaker,
// output_audio_codec: "pcm", sample_rate } } — then send { "text": ... } and
// collect base64 "audio_chunk" fields from the socket. Raw PCM back already,
// so no WAV header stripping needed.
//
// NOTE: the PDF does NOT document any flush/EOF message — it only shows
// sending {"text": ...} after config. An earlier version of this code sent
// an extra {"type":"flush"} frame that isn't part of the documented
// protocol; Sarvam was closing the socket with zero chunks because of it
// ("Sarvam TTS returned no audio"). That frame has been removed. Since the
// guide gives no explicit "done" signal, completion here is detected purely
// client-side: once chunks start arriving, a short idle gap means synthesis
// is finished (this doesn't modify the Sarvam protocol, just our own
// bookkeeping around it).
function synthesizeSpeech(text, languageCode = 'te-IN') {
  return new Promise((resolve, reject) => {
    if (!text || !text.trim()) return resolve(Buffer.alloc(0));

    const key = getSarvamKey();
    const chunks = [];
    let settled = false;
    let idleTimer = null;

    const ws = new WebSocket(SARVAM_TTS_WS_URL, {
      headers: { 'api-subscription-key': key },
    });

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(overallTimer);
      clearTimeout(idleTimer);
      ws.close();
      const audio = Buffer.concat(chunks);
      if (audio.length === 0) {
        reject(new Error('Sarvam TTS returned no audio'));
      } else {
        console.log(`[sarvam-tts] synthesized "${text.slice(0, 50)}"`);
        resolve(audio);
      }
    };

    const overallTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        clearTimeout(idleTimer);
        ws.terminate();
        reject(new Error('Sarvam TTS WebSocket timed out'));
      }
    }, 15000);

    ws.on('open', () => {
      console.log('[sarvam-tts] ws open');
      ws.send(JSON.stringify({
        type: 'config',
        data: {
          target_language_code: languageCode,
          speaker: 'shubh',              // valid bulbul:v3 speaker (anushka is v2-only)
          output_audio_codec: 'linear16', // real values: linear16/mulaw/alaw/opus/flac/aac/wav/mp3 — 'pcm' isn't one
          speech_sample_rate: 8000,       // real key is speech_sample_rate, not sample_rate
        },
      }));
      ws.send(JSON.stringify({ text }));
    });

    ws.on('message', (raw) => {
      const str = raw.toString();
      try {
        const data = JSON.parse(str);
        if (data.audio_chunk) {
          chunks.push(Buffer.from(data.audio_chunk, 'base64'));
          // reset idle timer — finish 600ms after the last chunk arrives
          clearTimeout(idleTimer);
          idleTimer = setTimeout(finish, 600);
        } else {
          // log non-audio frames (errors, acks, unexpected shapes) so we
          // can see exactly what Sarvam is sending back
          console.log(`[sarvam-tts] ws message (no audio_chunk): ${str.slice(0, 300)}`);
        }
      } catch (e) {
        console.log(`[sarvam-tts] ws non-JSON message: ${str.slice(0, 300)}`);
      }
    });

    ws.on('unexpected-response', (req, res) => {
      console.log(`[sarvam-tts] unexpected-response status=${res.statusCode}`);
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => console.log(`[sarvam-tts] unexpected-response body: ${body.slice(0, 300)}`));
    });

    ws.on('error', (err) => {
      console.log(`[sarvam-tts] ws error: ${err.message}`);
      if (!settled) {
        settled = true;
        clearTimeout(overallTimer);
        clearTimeout(idleTimer);
        reject(err);
      }
    });

    ws.on('close', (code, reasonBuf) => {
      console.log(`[sarvam-tts] ws closed code=${code} reason=${reasonBuf ? reasonBuf.toString() : ''} chunks=${chunks.length}`);
      // server closed the socket on its own — treat as end of stream
      finish();
    });
  });
}

module.exports = { transcribeAudio, synthesizeSpeech };