// backend/src/services/aiCaller/sarvamClient.js
//
// STT: saaras:v3 model, sample_rate=8000, high_vad_sensitivity=true (confirmed working)
// TTS: bulbul:v3 model over WebSocket (wss://api.sarvam.ai/text-to-speech/ws?model=bulbul:v3).
//   Verified against Sarvam's live API docs (docs.sarvam.ai), NOT the PDF
//   guides, which had two separate bugs:
//     - config key is `speech_sample_rate`, not `sample_rate`
//     - output_audio_codec values are linear16/mulaw/alaw/opus/flac/aac/wav/mp3
//       ('pcm' is not a valid value — 'linear16' is the raw-PCM equivalent)
//     - speaker `shubh` is valid for bulbul:v3 (`anushka` is a bulbul:v2-only voice)
//     - THE MAIN BUG: the text-to-synthesize message must use "type": "text",
//       not "type": "convert" (which both PDFs got wrong in different ways —
//       see the synthesizeSpeech() comment below for the full story). This
//       was causing Sarvam to reject every single TTS request with a 422,
//       which is why the agent could never speak.
// Exotel sends/expects raw PCM16 8kHz 16-bit (per PDF spec — NOT mulaw)
//
// ABORT SUPPORT (this pass): both transcribeAudio() and synthesizeSpeech()
// now accept an optional AbortSignal so a barge-in or turn-timeout in
// orchestrator.js can actually cancel an in-flight STT/TTS call instead of
// letting it run to completion in the background — which was letting a
// stale turn's audio land on top of the next turn's reply.

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
async function transcribeAudio(pcm16Bytes, { signal } = {}) {
  if (!pcm16Bytes || pcm16Bytes.length < 320) return '';
  if (signal?.aborted) return '';

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
    signal,
  });

  const transcript = (response.data.transcript || '').trim();
  if (transcript) console.log(`[sarvam-stt] "${transcript.slice(0, 80)}"`);
  return transcript;
}

// ─── TTS ─────────────────────────────────────────────────────────────────────
// Verified against the OFFICIAL Sarvam docs (docs.sarvam.ai/api-reference-docs/
// api-guides-tutorials/text-to-speech/streaming-api/web-socket), not the PDF
// guides, which turned out to be wrong on the wire format.
//
// The WS protocol is a discriminated union of exactly 4 input message types,
// each named to match its `type` field: Config Message ("config"), Text
// Message ("text"), Flush Message ("flush"), Ping Message ("ping").
//
// ROOT CAUSE OF THE TTS BUG: this file was sending `{"type": "convert", ...}`
// for the text payload (copied from the PDF guides, neither of which
// actually got the text-message shape right — one used a bare {"text":...}
// with no envelope, the other guessed "convert"). "convert" is not a member
// of Sarvam's discriminated union, so the server can't match it to any known
// schema and rejects it with the generic 422 "Input parameters has to be a
// valid dictionary" — on literally every utterance, exactly what the logs
// showed. Fix: use "text" as the type.
//
// Confirmed message shapes (per docs):
//   { "type": "config", "data": { target_language_code, speaker, pace,
//       min_buffer_size, max_chunk_length, output_audio_codec,
//       output_audio_bitrate, speech_sample_rate } }
//   { "type": "text",   "data": { "text": "..." } }
//   { "type": "flush" }
//   { "type": "ping" }
// Audio comes back as: { "type": "audio", "data": { "audio": "<base64>", "content_type": "..." } }
// Errors come back as: { "type": "error", "data": { "message": "...", "code": ... } }
//
// output_audio_codec="linear16" is Sarvam's raw-PCM value (docs literally
// list it as "pcm (LINEAR16)"), and speech_sample_rate=8000 is documented as
// supported "for all models & modes" including streaming — both needed so
// Sarvam hands back audio already in Exotel's 8kHz/16-bit PCM shape with no
// resampling needed on our end.
//
// STREAMING PLAYBACK: `onChunk`, if provided, is invoked synchronously with
// each raw PCM Buffer the instant it arrives from Sarvam — so the caller
// (orchestrator.js) can start forwarding audio to Exotel while Sarvam is
// still generating the rest of the reply, instead of waiting for the whole
// thing.
function synthesizeSpeech(text, languageCode = 'te-IN', onChunk = null, { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (!text || !text.trim()) return resolve(Buffer.alloc(0));
    if (signal?.aborted) return resolve(Buffer.alloc(0));

    const key = getSarvamKey();
    const chunks = [];
    let settled = false;
    let idleTimer = null;

    const ws = new WebSocket(SARVAM_TTS_WS_URL, {
      headers: { 'api-subscription-key': key },
    });

    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(overallTimer);
      clearTimeout(idleTimer);
      ws.terminate();
      reject(Object.assign(new Error('Sarvam TTS aborted'), { name: 'AbortError' }));
    };
    if (signal) signal.addEventListener('abort', onAbort);

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(overallTimer);
      clearTimeout(idleTimer);
      signal?.removeEventListener('abort', onAbort);
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
        signal?.removeEventListener('abort', onAbort);
        ws.terminate();
        reject(new Error('Sarvam TTS WebSocket timed out'));
      }
    }, 15000);

    // Track which message we last sent so a subsequent error can be
    // attributed precisely instead of guessing from a generic 422.
    let lastSent = null;

    ws.on('open', () => {
      console.log('[sarvam-tts] ws open');

      lastSent = 'config';
      ws.send(JSON.stringify({
        type: 'config',
        data: {
          target_language_code: languageCode,
          speaker: 'priya',                // female bulbul:v3 speaker (anushka is v2-only)
          pace: 1.32,                       // >1 = faster speech; fixes the slow/dragging voice
          output_audio_codec: 'linear16',   // Sarvam's raw-PCM value ("pcm (LINEAR16)" per docs)
          speech_sample_rate: 8000,         // 8000 Hz supported for all models/modes incl. streaming
        },
      }));

      // FIX: the text message's "type" must be "text", not "convert".
      // "convert" isn't a member of Sarvam's discriminated union, so the
      // server rejected it with a generic 422 on every single utterance.
      lastSent = 'text';
      ws.send(JSON.stringify({ type: 'text', data: { text } }));

      lastSent = 'flush';
      ws.send(JSON.stringify({ type: 'flush' }));
    });

    ws.on('message', (raw) => {
      const str = raw.toString();
      let data;
      try {
        data = JSON.parse(str);
      } catch (e) {
        console.log(`[sarvam-tts] ws non-JSON message: ${str.slice(0, 300)}`);
        return;
      }

      if (data.type === 'audio' && data.data && data.data.audio) {
        const buf = Buffer.from(data.data.audio, 'base64');
        chunks.push(buf);
        if (onChunk) {
          try { onChunk(buf); } catch (e) { console.error('[sarvam-tts] onChunk handler threw:', e.message); }
        }
        // Reset idle timer — finish shortly after the last chunk arrives.
        // This is only a safety margin for detecting end-of-stream (in case
        // the socket's own 'close' event is slower to fire than the actual
        // gap between chunks), not something the caller is blocked on,
        // since audio already streams to Exotel via onChunk as it arrives.
        clearTimeout(idleTimer);
        idleTimer = setTimeout(finish, 250);
      } else if (data.type === 'error') {
        const msg = data.data && data.data.message;
        console.log(`[sarvam-tts] ws error frame (after sending "${lastSent}"): ${msg || str.slice(0, 300)}`);
      } else if (data.type === 'event') {
        // completion event (send_completion_event) — informational only
        console.log(`[sarvam-tts] ws event: ${str.slice(0, 200)}`);
      } else {
        console.log(`[sarvam-tts] ws message (unrecognized, after sending "${lastSent}"): ${str.slice(0, 300)}`);
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
        signal?.removeEventListener('abort', onAbort);
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

// ─── Persistent TTS session (LATENCY FIX) ───────────────────────────────────
//
// BUG: synthesizeSpeech() above opens a brand-new WebSocket (fresh TCP + TLS
// handshake + Sarvam auth) for EVERY SINGLE SENTENCE. A normal agent turn is
// 2-3 sentences, so a turn that should only pay for one connection was
// paying for 2-3 — each one adding a few hundred ms before Sarvam even sees
// the text. That handshake tax was a big chunk of the reported 3-5s
// per-turn latency.
//
// FIX: createTtsSession() opens ONE WebSocket for the whole call (config
// sent once) and reuses it for every sentence via speak(text, onChunk) —
// same streamed-audio behavior as synthesizeSpeech(), just without paying
// the connection cost more than once per call.
function createTtsSession(languageCode = 'te-IN') {
  let socket = null;
  let openPromise = null;
  let closed = false;

  function open() {
    if (openPromise) return openPromise;
    openPromise = new Promise((resolve, reject) => {
      const key = getSarvamKey();
      const sock = new WebSocket(SARVAM_TTS_WS_URL, {
        headers: { 'api-subscription-key': key },
      });
      socket = sock;

      sock.once('open', () => {
        console.log('[sarvam-tts] session ws open');
        sock.send(JSON.stringify({
          type: 'config',
          data: {
            target_language_code: languageCode,
            speaker: 'priya',
            pace: 1.32,
            output_audio_codec: 'linear16',
            speech_sample_rate: 8000,
          },
        }));
        resolve();
      });

      sock.once('error', (err) => {
        console.log('[sarvam-tts] session ws error:', err.message);
        openPromise = null;
        reject(err);
      });

      sock.on('close', (code, reasonBuf) => {
        console.log(`[sarvam-tts] session ws closed code=${code} reason=${reasonBuf ? reasonBuf.toString() : ''}`);
        openPromise = null; // next speak() call will transparently reconnect
      });
    });
    return openPromise;
  }

  // Speaks one utterance over the shared connection. Resolves once audio
  // for THIS utterance stops arriving (same idle-gap heuristic as
  // synthesizeSpeech), so callers can still queue sentences one after
  // another exactly as before.
  async function speak(text, onChunk, { signal } = {}) {
    if (!text || !text.trim()) return;
    if (signal?.aborted || closed) return;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      await open();
    }
    const sock = socket;

    return new Promise((resolve, reject) => {
      let settled = false;
      let idleTimer = null;
      let receivedAny = false;

      const cleanup = () => {
        sock.removeListener('message', onMessage);
        sock.removeListener('error', onError);
        clearTimeout(idleTimer);
        clearTimeout(overallTimer);
        signal?.removeEventListener('abort', onAbort);
      };
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const onAbort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(Object.assign(new Error('Sarvam TTS aborted'), { name: 'AbortError' }));
      };
      if (signal) signal.addEventListener('abort', onAbort);

      const onMessage = (raw) => {
        let data;
        try { data = JSON.parse(raw.toString()); } catch { return; }

        if (data.type === 'audio' && data.data?.audio) {
          receivedAny = true;
          const buf = Buffer.from(data.data.audio, 'base64');
          if (onChunk) {
            try { onChunk(buf); } catch (e) { console.error('[sarvam-tts] onChunk threw:', e.message); }
          }
          // Shortened from 250ms -> 200ms: shaves a little more off the
          // tail of every utterance now that we're not also paying a
          // reconnect cost between sentences.
          clearTimeout(idleTimer);
          idleTimer = setTimeout(finish, 200);
        } else if (data.type === 'error') {
          console.log(`[sarvam-tts] session error frame: ${data.data?.message || raw.toString().slice(0, 300)}`);
        }
      };
      const onError = (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      };

      const overallTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          if (receivedAny) resolve();
          else reject(new Error('Sarvam TTS utterance timed out'));
        }
      }, 15000);

      sock.on('message', onMessage);
      sock.on('error', onError);

      sock.send(JSON.stringify({ type: 'text', data: { text } }));
      sock.send(JSON.stringify({ type: 'flush' }));
      console.log(`[sarvam-tts] synthesized "${text.slice(0, 50)}"`);
    });
  }

  function close() {
    closed = true;
    try { socket?.close(); } catch {}
  }

  return { speak, close };
}

module.exports = { transcribeAudio, synthesizeSpeech, createTtsSession };