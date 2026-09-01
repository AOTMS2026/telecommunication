const fs = require('fs');
const os = require('os');
const path = require('path');

function getRecordingsDir() {
  const localDir = path.join(__dirname, '..', 'uploads', 'recordings');
  const temporaryDir = path.join(os.tmpdir(), 'recordings');
  const candidates = process.env.RECORDINGS_DIR
    ? [process.env.RECORDINGS_DIR, temporaryDir]
    : process.env.NODE_ENV === 'production'
      ? [path.join('/var/data', 'recordings'), temporaryDir]
      : [localDir];

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
