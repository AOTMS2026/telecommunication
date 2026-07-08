// backend/src/services/aiCaller/sarvamClient.js
//
// LATENCY REWRITE:
//  - TTS: was opening a brand-new WebSocket (TLS+WS handshake) on every
//    single reply. Now createTtsSession() opens ONE socket per call and
//    reuses it for every turn (per Sarvam docs: "Single WebSocket connection
//    handles multiple text to speech conversions. Send config once, then
//    stream text continuously."). Only reopened after a barge-in, since the
//    TTS WS has no server-side cancel message (per docs: close + reopen is
//    the documented way to stop an interrupted utterance).
//  - STT: was a REST upload of the full buffered utterance (upload + wait).
//    Now createSttSession() opens ONE streaming WebSocket per call
//    (wss://api.sarvam.ai/speech-to-text/ws) and feeds it audio continuously
//    as it arrives from Exotel, so Sarvam's own server-side VAD finalizes
//    the transcript almost immediately after the caller stops talking —
//    usually before our local VAD threshold even fires. transcribeAudio()
//    (REST) is kept as a fallback if the streaming socket fails.

const axios = require('axios');
const https = require('https');
const FormData = require('form-data');
const WebSocket = require('ws');
const { EventEmitter } = require('events');

const SARVAM_STT_REST_URL = 'https://api.sarvam.ai/speech-to-text';
const SARVAM_STT_WS_URL = 'wss://api.sarvam.ai/speech-to-text/ws';
const SARVAM_TTS_WS_URL = 'wss://api.sarvam.ai/text-to-speech/ws?model=bulbul:v3';

// Reuse TCP+TLS connections across the REST fallback calls instead of
// renegotiating a handshake on every request.
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

function getSarvamKey() {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error('SARVAM_API_KEY is not configured');
  return key;
}

// ─── WAV helper ──────────────────────────────────────────────────────────────
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

// ─── STT (REST fallback — used only if the streaming socket fails) ──────────
async function transcribeAudio(pcm16Bytes, languageCode = 'te-IN') {
  if (!pcm16Bytes || pcm16Bytes.length < 320) return '';

  const key = getSarvamKey();
  const wavBuf = buildWavBuffer(pcm16Bytes, 8000, 1, 16);

  const form = new FormData();
  form.append('file', wavBuf, { filename: 'audio.wav', contentType: 'audio/wav' });
  form.append('language_code', languageCode);
  form.append('model', 'saaras:v3');
  form.append('sample_rate', '8000');
  form.append('high_vad_sensitivity', 'true');

  const response = await axios.post(SARVAM_STT_REST_URL, form, {
    headers: { ...form.getHeaders(), 'api-subscription-key': key },
    timeout: 12000,
    httpsAgent: keepAliveAgent,
  });

  const transcript = (response.data.transcript || '').trim();
  if (transcript) console.log(`[sarvam-stt-rest] "${transcript.slice(0, 80)}"`);
  return transcript;
}

// ─── STT (streaming session — one socket per call) ──────────────────────────
//
// Feed it raw PCM16 8kHz chunks as they arrive from Exotel via sendAudio().
// Sarvam's server-side VAD (high_vad_sensitivity => ~0.5s silence boundary)
// auto-finalizes and emits a transcript ("type":"data") without us having to
// send any flush command. Emits: 'transcript' (text), 'vad-event', 'error', 'close'.
function createSttSession({ languageCode = 'te-IN', sampleRate = 8000 } = {}) {
  const emitter = new EventEmitter();
  const key = getSarvamKey();
  let ws = null;
  let closedByUs = false;
  let reconnectAttempts = 0;
  const MAX_RECONNECTS = 3;

  function connect() {
    const qs = new URLSearchParams({
      'language-code': languageCode,
      model: 'saaras:v3',
      mode: 'transcribe',
      sample_rate: String(sampleRate),
      high_vad_sensitivity: 'true',
      vad_signals: 'true',
      input_audio_codec: 'wav',
    });
    ws = new WebSocket(`${SARVAM_STT_WS_URL}?${qs.toString()}`, {
      headers: { 'api-subscription-key': key },
    });

    ws.on('open', () => {
      reconnectAttempts = 0;
      console.log('[sarvam-stt] ws open');
    });

    ws.on('message', (raw) => {
      let data;
      try { data = JSON.parse(raw.toString()); } catch { return; }

      if (data.type === 'data' && data.data) {
        const transcript = (data.data.transcript || '').trim();
        if (transcript) emitter.emit('transcript', transcript);
      } else if (data.type === 'events') {
        emitter.emit('vad-event', data.data && data.data.signal_type);
      } else if (data.type === 'error') {
        console.log(`[sarvam-stt] ws error frame: ${JSON.stringify(data.data || {}).slice(0, 200)}`);
      }
    });

    ws.on('error', (err) => {
      console.log(`[sarvam-stt] ws error: ${err.message}`);
      emitter.emit('error', err);
    });

    ws.on('close', (code) => {
      if (closedByUs) return;
      console.log(`[sarvam-stt] ws closed code=${code}`);
      // Reconnect on network blips / server errors, per Sarvam's documented
      // close-code guidance. Don't retry on 4xxx (auth/quota) codes.
      if (code === 1006 || code === 1011) {
        if (reconnectAttempts < MAX_RECONNECTS) {
          reconnectAttempts++;
          const delay = Math.min(500 * 2 ** reconnectAttempts, 4000);
          setTimeout(connect, delay);
          return;
        }
      }
      emitter.emit('close', code);
    });
  }

  connect();

  // Buffer a little audio before sending — reduces message overhead vs.
  // forwarding every tiny Exotel frame individually.
  let buffer = Buffer.alloc(0);
  const SEND_THRESHOLD_BYTES = 1600; // ~100ms at 8kHz/16-bit mono

  function sendAudio(pcmChunk) {
    buffer = Buffer.concat([buffer, pcmChunk]);
    if (buffer.length < SEND_THRESHOLD_BYTES) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return; // dropped silently; REST fallback covers the turn if this never recovers

    const toSend = buffer;
    buffer = Buffer.alloc(0);
    const wavBuf = buildWavBuffer(toSend, sampleRate, 1, 16);
    try {
      ws.send(JSON.stringify({
        audio: {
          data: wavBuf.toString('base64'),
          sample_rate: String(sampleRate),
          encoding: 'audio/wav',
        },
      }));
    } catch (err) {
      console.log(`[sarvam-stt] send failed: ${err.message}`);
    }
  }

  function close() {
    closedByUs = true;
    try { if (ws) ws.close(); } catch {}
  }

  emitter.sendAudio = sendAudio;
  emitter.close = close;
  return emitter;
}

// ─── TTS (persistent session — one socket per call, reused across turns) ────
//
// speak(text) can be called multiple times on the same session (multiple
// sentence chunks of one reply, or successive replies) — config is sent
// once on open. onAudioChunk(buf) fires for every PCM chunk as it streams
// in, so the caller can start playback while Sarvam is still synthesizing.
// abort() closes the socket (used on barge-in, since there's no server-side
// cancel) — the session lazily reconnects on the next speak() call.
function createTtsSession({ languageCode = 'te-IN', onAudioChunk = () => {}, onIdle = () => {} } = {}) {
  const key = getSarvamKey();
  let ws = null;
  let ready = false;
  let queue = [];
  let idleTimer = null;
  let pingTimer = null;
  let closedByUs = false;

  function scheduleIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(onIdle, 250);
  }

  function schedulePing() {
    clearTimeout(pingTimer);
    pingTimer = setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'ping' })); } catch {}
        schedulePing();
      }
    }, 20000); // keep the socket alive between turns (idle sockets close after ~1min)
  }

  function sendText(text) {
    ws.send(JSON.stringify({ type: 'text', data: { text } }));
    ws.send(JSON.stringify({ type: 'flush' }));
  }

  function connect() {
    closedByUs = false;
    ready = false;
    ws = new WebSocket(SARVAM_TTS_WS_URL, { headers: { 'api-subscription-key': key } });

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'config',
        data: {
          target_language_code: languageCode,
          speaker: 'shubh',
          output_audio_codec: 'linear16',
          speech_sample_rate: 8000,
        },
      }));
      ready = true;
      schedulePing();
      const toSend = queue;
      queue = [];
      toSend.forEach(sendText);
    });

    ws.on('message', (raw) => {
      let data;
      try { data = JSON.parse(raw.toString()); } catch { return; }

      if (data.type === 'audio' && data.data && data.data.audio) {
        onAudioChunk(Buffer.from(data.data.audio, 'base64'));
        scheduleIdle();
      } else if (data.type === 'error') {
        console.log(`[sarvam-tts] ws error frame: ${JSON.stringify(data.data || {}).slice(0, 200)}`);
      }
    });

    ws.on('error', (err) => console.log(`[sarvam-tts] ws error: ${err.message}`));

    ws.on('close', (code) => {
      ready = false;
      clearTimeout(pingTimer);
      if (!closedByUs) console.log(`[sarvam-tts] ws closed unexpectedly code=${code}`);
    });
  }

  connect();

  function speak(text) {
    if (!text || !text.trim()) return;
    if (ready && ws && ws.readyState === WebSocket.OPEN) {
      sendText(text);
    } else {
      queue.push(text);
      if (!ws || ws.readyState === WebSocket.CLOSED) connect();
    }
  }

  // Barge-in: no server-side cancel exists, so close outright. Next speak()
  // call transparently reconnects.
  function abort() {
    closedByUs = true;
    clearTimeout(idleTimer);
    clearTimeout(pingTimer);
    queue = [];
    try { if (ws) ws.terminate(); } catch {}
  }

  function close() {
    closedByUs = true;
    clearTimeout(idleTimer);
    clearTimeout(pingTimer);
    try { if (ws) ws.close(); } catch {}
  }

  return { speak, abort, close };
}

module.exports = { transcribeAudio, createSttSession, createTtsSession, keepAliveAgent };