const path = require('path');

function isZipPath(filePath) {
  return typeof filePath === 'string' && path.extname(filePath).toLowerCase() === '.zip';
}

function extractZipPathFromArgv(argv = []) {
  return argv.find((arg) => isZipPath(arg)) || null;
}

module.exports = {
  isZipPath,
  extractZipPathFromArgv
};
