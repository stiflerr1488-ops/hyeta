#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const portablePattern = /^hyeta-visual-editor .*\.exe$/i;
const buildArgs = ['electron-builder', '--win', 'portable', '--x64'];

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options
  });

  if (result.error) {
    return { ok: false, error: result.error };
  }

  return { ok: result.status === 0, status: result.status ?? 1 };
}

function listPortableFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && portablePattern.test(entry.name))
    .map((entry) => path.join(directory, entry.name));
}

function removePortableFiles(files) {
  for (const filePath of files) {
    fs.rmSync(filePath, { force: true });
    console.log(`Removed old portable build: ${path.basename(filePath)}`);
  }
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

function movePortableToRoot() {
  const distPortableFiles = listPortableFiles(distDir);
  if (distPortableFiles.length === 0) {
    throw new Error('Portable .exe was not found in dist after build.');
  }

  const latestPortable = distPortableFiles
    .map((filePath) => ({
      filePath,
      mtimeMs: fs.statSync(filePath).mtimeMs
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].filePath;

  const targetPath = path.join(rootDir, path.basename(latestPortable));
  fs.renameSync(latestPortable, targetPath);
  console.log(`Portable build moved to project root: ${path.basename(targetPath)}`);
}

removePortableFiles([...listPortableFiles(distDir), ...listPortableFiles(rootDir)]);
buildPortable();
movePortableToRoot();
