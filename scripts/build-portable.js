#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const portablePattern = /^hyeta-visual-editor .*\.exe$/i;

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
    try {
      fs.rmSync(filePath, { force: true });
      console.log(`Removed old portable build: ${path.basename(filePath)}`);
    } catch (error) {
      console.warn(`Could not delete old portable file ${path.basename(filePath)}: ${error.message}`);
      console.warn('Close the running .exe and retry the build.');
    }
  }
}

function runLocalBuilder() {
  const localBuilder = process.platform === 'win32'
    ? path.join(rootDir, 'node_modules', '.bin', 'electron-builder.cmd')
    : path.join(rootDir, 'node_modules', '.bin', 'electron-builder');

  if (!fs.existsSync(localBuilder)) {
    return { ok: false, status: 1 };
  }

  return runCommand(localBuilder, ['--win', 'portable', '--x64']);
}

function buildPortable() {
  console.log('Building portable executable (electron-builder --win portable --x64)...');

  const localResult = runLocalBuilder();
  if (localResult.ok) {
    return;
  }

  if (localResult.error) {
    console.warn(`Local electron-builder failed to start: ${localResult.error.message}`);
  } else {
    console.warn('Local electron-builder failed. Trying npx fallback...');
  }

  const npxResult = runCommand('npx', ['electron-builder', '--win', 'portable', '--x64']);
  if (!npxResult.ok) {
    if (npxResult.error) {
      throw npxResult.error;
    }
    process.exit(npxResult.status);
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

  fs.copyFileSync(latestPortable, targetPath);
  fs.rmSync(latestPortable, { force: true });
  console.log(`Portable build moved to project root: ${path.basename(targetPath)}`);
}

function main() {
  removePortableFiles([...listPortableFiles(distDir), ...listPortableFiles(rootDir)]);
  buildPortable();
  movePortableToRoot();
}

try {
  main();
} catch (error) {
  console.error(`Portable build script failed: ${error.message}`);
  process.exit(1);
}
