#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const portablePattern = /^hyeta-visual-editor .*\.exe$/i;

function removeOldPortableBuilds() {
  if (!fs.existsSync(distDir)) {
    return;
  }

  const entries = fs.readdirSync(distDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    if (!portablePattern.test(entry.name)) {
      continue;
    }

    fs.rmSync(path.join(distDir, entry.name), { force: true });
    console.log(`Removed old portable build: ${entry.name}`);
  }
}

function buildPortable() {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(command, ['electron-builder', '--win', 'portable', '--x64'], {
    cwd: rootDir,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

removeOldPortableBuilds();
buildPortable();
