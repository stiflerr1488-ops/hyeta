const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function sanitizeBaseName(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'project';
}

function createExtractionDir(userDataPath, zipFilePath, now = Date.now()) {
  const base = sanitizeBaseName(path.basename(zipFilePath, path.extname(zipFilePath)));
  return path.join(userDataPath, 'imports', `${base}-${now}`);
}

async function extractZipArchive(zipFilePath, destinationDir) {
  await fs.mkdir(destinationDir, { recursive: true });

  if (process.platform === 'win32') {
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Expand-Archive -LiteralPath '${zipFilePath.replace(/'/g, "''")}' -DestinationPath '${destinationDir.replace(/'/g, "''")}' -Force`
    ]);
    return;
  }

  try {
    await execFileAsync('unzip', ['-q', zipFilePath, '-d', destinationDir]);
  } catch (error) {
    const stderr = String(error.stderr || '');
    throw new Error(`Cannot extract zip archive. Ensure unzip is installed. ${stderr}`.trim());
  }
}

module.exports = {
  sanitizeBaseName,
  createExtractionDir,
  extractZipArchive
};
// updated-all-files
