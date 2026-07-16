// backend/src/services/aiCaller/sarvamClient.js
//
// STT: saaras:v3 model, sample_rate=8000, high_vad_sensitivity=true.
// TTS: bulbul:v2 model over WebSocket (wss://api.sarvam.ai/text-to-speech/ws?model=bulbul:v2).
//
// BUG FIX (this pass): STT was calling model: 'saaras:v2' — that model
// name does not exist in Sarvam's current API (their models are
// 'saaras:v3' [current/recommended] and 'saaras:v2.5' [legacy, being
// deprecated] — never a bare 'v2'). Every transcription request was
// rejected with 400 Bad Request as a result, which is why STT failed on
// literally every attempt in the last test call, immediately, with no
// intermittent success. Switched to 'saaras:v3' and added the matching
// mode: 'transcribe' parameter (only meaningful for v3, ignored otherwise,
// and 'transcribe' is the default anyway — set explicitly for clarity).
//
// ROOT CAUSE FIX (prior pass) — "TTS opens, then stops after generation
// completes": the persistent session socket had NO way to tell an in-flight
// speak() call that the socket had died. If Sarvam idle-closed the WS mid
// utterance (or it dropped for any other reason), speak() just sat there —
// its message/error listeners were on a now-dead socket — until its own
// 15s overallTimer finally fired. Since orchestrator.js's TURN_TIMEOUT_MS
// is 12s, the turn-level abort fired FIRST and killed the whole turn
// (STT+GPT+TTS) before the TTS call ever got a chance to time out on its
// own — which looks exactly like "TTS stops as soon as generation
// finishes" from the caller's side: dead air, then a hard cut.
//
// Also fixed: the completion-event check only matched
// `data.data.event_type === 'final'`. Real completion events from Sarvam
// didn't match that shape, so EVERY sentence fell through to the 1500ms
// idle-timer fallback as its ONLY completion signal — i.e. ~1.5s of dead
// air tacked onto the end of every single sentence, compounding across a
// multi-sentence reply. Completion is now detected the same (lenient) way
// synthesizeSpeech() already did it: any `type: "event"` message ends the
// utterance immediately.
//
// Also added: a keepalive ping on the persistent session socket so Sarvam
// doesn't idle-close it between turns (STT+GPT thinking time can exceed
// whatever idle window Sarvam enforces), which was the trigger for the
// dead-socket scenario above in the first place.

const axios = require('axios');
const FormData = require('form-data');
const WebSocket = require('ws');

const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';
const SARVAM_TTS_WS_URL = 'wss://api.sarvam.ai/text-to-speech/ws?model=bulbul:v2&send_completion_event=true';
const TTS_KEEPALIVE_MS = 15000; // must stay well under Sarvam's own idle-close window

function getSarvamKey() {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error('SARVAM_API_KEY is not configured');
  return key;
}

function stripWavHeaderIfPresent(buf) {
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') {
    const dataIdx = buf.indexOf('data', 12, 'ascii');
    if (dataIdx !== -1 && dataIdx + 8 <= buf.length) {
      return buf.subarray(dataIdx + 8);
    }
    return buf.subarray(Math.min(44, buf.length));
  }
  return buf;
}

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

// ─── STT ─────────────────────────────────────────────────────────────────────
async function transcribeAudio(pcm16Bytes, { signal, languageCode } = {}) {
  if (!pcm16Bytes || pcm16Bytes.length < 320) return '';
  if (signal?.aborted) return '';

  const key = getSarvamKey();
  const wavBuf = buildWavBuffer(pcm16Bytes, 8000, 1, 16);

  const form = new FormData();
  form.append('file', wavBuf, { filename: 'audio.wav', contentType: 'audio/wav' });
  form.append('language_code', languageCode || 'unknown'); // 'unknown' = Sarvam auto-detects (documented, valid)
  form.append('model', 'saaras:v3'); // was 'saaras:v2' — not a real model name, caused 400 on every call
  form.append('mode', 'transcribe'); // only meaningful for v3; explicit for clarity (this is the default anyway)
  form.append('sample_rate', '8000');
  form.append('high_vad_sensitivity', 'true');

  const response = await axios.post(SARVAM_STT_URL, form, {
    headers: { ...form.getHeaders(), 'api-subscription-key': key },
    timeout: 12000,
    signal,
  });

  const transcript = (response.data.transcript || '').trim();
  if (transcript) console.log(`[sarvam-stt] "${transcript.slice(0, 80)}"`);
  return transcript;
}

// ─── One-shot TTS (kept for any caller not using the persistent session) ────
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

    let lastSent = null;

    ws.on('open', () => {
      console.log('[sarvam-tts] ws open');

      lastSent = 'config';
      ws.send(JSON.stringify({
        type: 'config',
        data: {
          target_language_code: languageCode,
          speaker: 'priya',
          pace: 1.15,
          output_audio_codec: 'linear16',
          speech_sample_rate: 8000,
        },
      }));

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
        const buf = stripWavHeaderIfPresent(Buffer.from(data.data.audio, 'base64'));
        chunks.push(buf);
        if (onChunk) {
          try { onChunk(buf); } catch (e) { console.error('[sarvam-tts] onChunk handler threw:', e.message); }
        }
        clearTimeout(idleTimer);
        idleTimer = setTimeout(finish, 1500);
      } else if (data.type === 'error') {
        const msg = data.data && data.data.message;
        console.log(`[sarvam-tts] ws error frame (after sending "${lastSent}"): ${msg || str.slice(0, 300)}`);
      } else if (data.type === 'event') {
        console.log(`[sarvam-tts] ws event: ${str.slice(0, 200)}`);
        clearTimeout(idleTimer);
        finish();
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
      finish();
    });
  });
}

// ─── Persistent TTS session ──────────────────────────────────────────────────
function createTtsSession(languageCode = 'te-IN') {
  let socket = null;
  let openPromise = null;
  let closed = false;
  let keepaliveTimer = null;
  let activeCall = null;

  function clearKeepalive() {
    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    }
  }

  function armKeepalive(sock) {
    clearKeepalive();
    keepaliveTimer = setInterval(() => {
      if (sock.readyState === WebSocket.OPEN) {
        try { sock.send(JSON.stringify({ type: 'ping' })); } catch {}
      }
    }, TTS_KEEPALIVE_MS);
  }

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
            speaker: 'anushka',
            pace: 1.15,
            output_audio_codec: 'linear16',
            speech_sample_rate: 8000,
          },
        }));
        armKeepalive(sock);
        resolve();
      });

      sock.once('error', (err) => {
        console.log('[sarvam-tts] session ws error:', err.message);
        openPromise = null;
        reject(err);
      });

      sock.on('close', (code, reasonBuf) => {
        console.log(`[sarvam-tts] session ws closed code=${code} reason=${reasonBuf ? reasonBuf.toString() : ''}`);
        openPromise = null;
        clearKeepalive();
        if (activeCall) activeCall.onSocketDown();
      });
    });
    return openPromise;
  }

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
        if (activeCall === thisCall) activeCall = null;
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

      const onSocketDown = () => {
        if (settled) return;
        settled = true;
        cleanup();
        if (receivedAny) resolve();
        else reject(Object.assign(new Error('Sarvam TTS socket closed unexpectedly'), { name: 'SocketClosed' }));
      };
      const thisCall = { onSocketDown };
      activeCall = thisCall;

      const onMessage = (raw) => {
        let data;
        try { data = JSON.parse(raw.toString()); } catch { return; }

        if (data.type === 'audio' && data.data?.audio) {
          receivedAny = true;
          const buf = stripWavHeaderIfPresent(Buffer.from(data.data.audio, 'base64'));
          if (onChunk) {
            try { onChunk(buf); } catch (e) { console.error('[sarvam-tts] onChunk threw:', e.message); }
          }
          clearTimeout(idleTimer);
          idleTimer = setTimeout(finish, 1500);
        } else if (data.type === 'event') {
          clearTimeout(idleTimer);
          finish();
        } else if (data.type === 'error') {
          const msg = data.data?.message || raw.toString().slice(0, 300);
          console.log(`[sarvam-tts] session error frame: ${msg}`);
          if (settled) return;
          settled = true;
          cleanup();
          if (receivedAny) resolve();
          else reject(Object.assign(new Error(`Sarvam TTS error: ${msg}`), { name: 'SarvamTtsError' }));
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
    clearKeepalive();
    activeCall = null;
    try { socket?.close(); } catch {}
  }

  function warm() {
    if (closed) return;
    open().catch((err) => {
      console.log('[sarvam-tts] warm() handshake failed (will retry on first speak()):', err.message);
    });
  }

  return { speak, close, warm };
}

module.exports = { transcribeAudio, synthesizeSpeech, createTtsSession };