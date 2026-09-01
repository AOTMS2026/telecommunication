const fs = require('fs');
const os = require('os');
const path = require('path');

function getRecordingsDir() {
  const localDir = path.join(__dirname, '..', 'uploads', 'recordings');
  const candidates = process.env.NODE_ENV === 'production'
    ? [process.env.RECORDINGS_DIR || path.join('/var/data', 'recordings'), path.join(os.tmpdir(), 'recordings')]
    : [process.env.RECORDINGS_DIR || localDir];

  for (const directory of candidates) {
    try {
      fs.mkdirSync(directory, { recursive: true });
      fs.accessSync(directory, fs.constants.W_OK);
      if (directory !== candidates[0]) {
        console.warn(`Recordings directory ${candidates[0]} is unavailable; using ${directory}.`);
      }
      return directory;
    } catch (error) {
    }
  }

  throw new Error(`No writable recordings directory found. Tried: ${candidates.join(', ')}`);
}

module.exports = { getRecordingsDir };
