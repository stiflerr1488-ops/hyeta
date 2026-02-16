const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { buildProjectIndex, findInProject } = require('../src/shared/project-index');

async function withTempProject(run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyeta-'));
  await fs.writeFile(path.join(dir, 'index.html'), '<h1>Hello CTA</h1>', 'utf8');
  await fs.writeFile(path.join(dir, 'about.html'), '<p>Case study</p>', 'utf8');
  await fs.writeFile(path.join(dir, 'styles.css'), '.cta{color:red}', 'utf8');
  await fs.mkdir(path.join(dir, 'assets'));
  await fs.writeFile(path.join(dir, 'assets', 'logo.svg'), '<svg/>', 'utf8');
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('buildProjectIndex returns html pages and tree', async () => {
  await withTempProject(async (dir) => {
    const index = await buildProjectIndex(dir);
    assert.deepEqual(index.htmlPages.sort(), ['about.html', 'index.html']);
    assert.ok(index.tree.length >= 3);
  });
});

test('findInProject finds text occurrences', async () => {
  await withTempProject(async (dir) => {
    const results = await findInProject(dir, 'cta');
    assert.ok(results.some((r) => r.path === 'index.html'));
    assert.ok(results.some((r) => r.path === 'styles.css'));
  });
});
