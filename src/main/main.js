const { app, BrowserWindow, ipcMain, dialog, protocol, session } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { buildProjectIndex, findInProject } = require('../shared/project-index');
const { createExtractionDir, extractZipArchive } = require('./zip-import');

const APP_SCHEME = 'appfs';
let currentProjectRoot = null;

function normalizePath(projectRoot, relativePath) {
  const resolved = path.resolve(projectRoot, relativePath);
  if (!resolved.startsWith(path.resolve(projectRoot))) {
    throw new Error('Path escapes project root');
  }
  return resolved;
}

async function readUtf8(absolutePath) {
  return fs.readFile(absolutePath, 'utf8');
}

async function createMainWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  await win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function registerAppFsProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    if (!currentProjectRoot) {
      return new Response('No project loaded', { status: 400 });
    }

    const url = new URL(request.url);
    const relativePath = decodeURIComponent(url.pathname.replace(/^\//, ''));
    const target = normalizePath(currentProjectRoot, relativePath || 'index.html');

    try {
      const data = await fs.readFile(target);
      const ext = path.extname(target).toLowerCase();
      const mime = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon',
        '.xml': 'application/xml',
        '.txt': 'text/plain',
        '.webmanifest': 'application/manifest+json'
      }[ext] || 'application/octet-stream';

      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'no-store'
        }
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

function lockDownPreviewNetwork() {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    const allowed = url.protocol === `${APP_SCHEME}:` || url.protocol === 'data:' || url.protocol === 'blob:';
    callback({ cancel: !allowed });
  });
}

ipcMain.handle('project:open', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  currentProjectRoot = result.filePaths[0];
  const index = await buildProjectIndex(currentProjectRoot);
  return {
    projectRoot: currentProjectRoot,
    ...index
  };
});


ipcMain.handle('project:open-zip', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'ZIP archive', extensions: ['zip'] }]
  });

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  const zipFilePath = result.filePaths[0];
  const extractionDir = createExtractionDir(app.getPath('userData'), zipFilePath);
  await extractZipArchive(zipFilePath, extractionDir);

  currentProjectRoot = extractionDir;
  const index = await buildProjectIndex(currentProjectRoot);
  return {
    projectRoot: currentProjectRoot,
    sourceZip: zipFilePath,
    ...index
  };
});

ipcMain.handle('project:read-file', async (_event, relativePath) => {
  if (!currentProjectRoot) throw new Error('Project not loaded');
  return readUtf8(normalizePath(currentProjectRoot, relativePath));
});

ipcMain.handle('project:write-file', async (_event, relativePath, content) => {
  if (!currentProjectRoot) throw new Error('Project not loaded');
  await fs.writeFile(normalizePath(currentProjectRoot, relativePath), content, 'utf8');
  return { ok: true };
});

ipcMain.handle('project:replace-asset', async (_event, { targetRelativePath, sourceAbsolutePath }) => {
  if (!currentProjectRoot) throw new Error('Project not loaded');
  const destination = normalizePath(currentProjectRoot, targetRelativePath);
  await fs.copyFile(sourceAbsolutePath, destination);
  return { ok: true };
});

ipcMain.handle('project:search', async (_event, query) => {
  if (!currentProjectRoot) throw new Error('Project not loaded');
  if (!query || !query.trim()) return [];
  return findInProject(currentProjectRoot, query.trim());
});

app.whenReady().then(async () => {
  registerAppFsProtocol();
  lockDownPreviewNetwork();
  await createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
