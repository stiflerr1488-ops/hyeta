const test = require('node:test');
const assert = require('node:assert/strict');
const { isZipPath, extractZipPathFromArgv } = require('../src/main/open-zip-args');

test('isZipPath определяет ZIP вне зависимости от регистра расширения', () => {
  assert.equal(isZipPath('/tmp/site.zip'), true);
  assert.equal(isZipPath('C:/Work/SITE.ZIP'), true);
  assert.equal(isZipPath('/tmp/site.tar.gz'), false);
  assert.equal(isZipPath(null), false);
});

test('extractZipPathFromArgv возвращает первый ZIP аргумент', () => {
  const args = ['--flag', '/tmp/project.zip', '/tmp/other.zip'];
  assert.equal(extractZipPathFromArgv(args), '/tmp/project.zip');
  assert.equal(extractZipPathFromArgv(['--inspect']), null);
});
