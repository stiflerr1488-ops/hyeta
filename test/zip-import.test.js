const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { sanitizeBaseName, createExtractionDir } = require('../src/main/zip-import');

test('sanitizeBaseName нормализует небезопасные символы', () => {
  assert.equal(sanitizeBaseName('NP Maps 2026!!!'), 'NP-Maps-2026');
  assert.equal(sanitizeBaseName('////'), 'project');
});

test('createExtractionDir создаёт детерминированный путь директории импорта', () => {
  const result = createExtractionDir('/tmp/appdata', '/work/My Site.zip', 1700000000000);
  assert.equal(result, path.join('/tmp/appdata', 'imports', 'My-Site-1700000000000'));
});
// updated-all-files
