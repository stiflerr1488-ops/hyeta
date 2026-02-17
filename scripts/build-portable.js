#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const portablePattern = /^hyeta-visual-editor .*\.exe$/i;
const buildArgs = ['electron-builder', '--win', 'portable', '--x64'];

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

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32' ? true : false,
    ...options
  });

  if (result.error) {
    return { ok: false, error: result.error };
  }

  return { ok: result.status === 0, status: result.status ?? 1 };
}

function buildPortable() {
  const npxResult = runCommand('npx', buildArgs);
  if (npxResult.ok) {
    return;
  }

  if (npxResult.error) {
    console.warn(`npx failed to start: ${npxResult.error.message}`);
  }

  console.warn('Trying local electron-builder binary...');
  const localBuilder = process.platform === 'win32'
    ? path.join(rootDir, 'node_modules', '.bin', 'electron-builder.cmd')
    : path.join(rootDir, 'node_modules', '.bin', 'electron-builder');
  const localResult = runCommand(localBuilder, ['--win', 'portable', '--x64']);

  if (!localResult.ok) {
    if (localResult.error) {
      throw localResult.error;
    }

    process.exit(localResult.status);
  }
}

removeOldPortableBuilds();
buildPortable();
