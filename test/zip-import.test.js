const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { sanitizeBaseName, createExtractionDir } = require('../src/main/zip-import');

test('sanitizeBaseName normalizes unsafe characters', () => {
  assert.equal(sanitizeBaseName('NP Maps 2026!!!'), 'NP-Maps-2026');
  assert.equal(sanitizeBaseName('////'), 'project');
});

test('createExtractionDir builds deterministic import directory path', () => {
  const result = createExtractionDir('/tmp/appdata', '/work/My Site.zip', 1700000000000);
  assert.equal(result, path.join('/tmp/appdata', 'imports', 'My-Site-1700000000000'));
});
// updated-all-files
