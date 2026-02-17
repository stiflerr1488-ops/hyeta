const { app, BrowserWindow, ipcMain, dialog, protocol, session, Menu } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { buildProjectIndex, findInProject } = require('../shared/project-index');
const { createExtractionDir, extractZipArchive } = require('./zip-import');

const APP_SCHEME = 'appfs';
let currentProjectRoot = null;
let appMenu = null;

function normalizePath(projectRoot, relativePath) {
  const resolved = path.resolve(projectRoot, relativePath);
  if (!resolved.startsWith(path.resolve(projectRoot))) {
    throw new Error('Путь выходит за пределы корня проекта');
  }
  return resolved;
}


function getActiveWindow() {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
}

function triggerRendererAction(elementId) {
  const win = getActiveWindow();
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript(`document.getElementById(${JSON.stringify(elementId)})?.click();`);
}

function buildApplicationMenu() {
  const template = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Открыть папку с сайтом',
          accelerator: 'CmdOrCtrl+O',
          click: () => triggerRendererAction('openProjectBtn')
        },
        {
          label: 'Открыть ZIP-архив',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => triggerRendererAction('openZipBtn')
        },
        { type: 'separator' },
        {
          label: 'Сохранить',
          accelerator: 'CmdOrCtrl+S',
          click: () => triggerRendererAction('saveBtn')
        },
        { type: 'separator' },
        { label: 'Выход', role: 'quit' }
      ]
    },
    {
      label: 'Правка',
      submenu: [
        {
          label: 'Отменить',
          accelerator: 'CmdOrCtrl+Z',
          click: () => triggerRendererAction('undoBtn')
        },
        {
          label: 'Повторить',
          accelerator: 'CmdOrCtrl+Y',
          click: () => triggerRendererAction('redoBtn')
        },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectAll', label: 'Выделить всё' }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Перезагрузить' },
        { role: 'forceReload', label: 'Полная перезагрузка' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Сброс масштаба' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полный экран' }
      ]
    },
    {
      label: 'Справка',
      submenu: [
        {
          label: 'О программе',
          click: () => {
            const win = getActiveWindow();
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'О программе',
              message: 'Hyeta — визуальный редактор сайта',
              detail: 'Откройте папку или ZIP-архив и редактируйте страницы визуально.'
            });
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about', label: 'О программе' },
        { type: 'separator' },
        { role: 'quit', label: 'Выход' }
      ]
    });
  }

  return Menu.buildFromTemplate(template);
}

function registerApplicationMenu() {
  appMenu = buildApplicationMenu();
  Menu.setApplicationMenu(appMenu);
}

function applyWindowMenu(win) {
  if (!win || win.isDestroyed()) return;
  if (!appMenu) {
    appMenu = buildApplicationMenu();
  }

  win.setMenu(appMenu);
  win.setMenuBarVisibility(true);
}

async function readUtf8(absolutePath) {
  return fs.readFile(absolutePath, 'utf8');
}

async function createMainWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Hyeta — визуальный редактор',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  applyWindowMenu(win);
  await win.loadFile(path.join(__dirname, '../renderer/index.html'));
  applyWindowMenu(win);
}

function registerAppFsProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    if (!currentProjectRoot) {
      return new Response('Проект не загружен', { status: 400 });
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
      return new Response('Не найдено', { status: 404 });
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

ipcMain.handle('project:open', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || getActiveWindow();
  const result = await dialog.showOpenDialog(win, {
    title: 'Выберите папку с сайтом',
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


ipcMain.handle('project:open-zip', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || getActiveWindow();
  const result = await dialog.showOpenDialog(win, {
    title: 'Выберите ZIP-архив с сайтом',
    buttonLabel: 'Открыть архив',
    properties: ['openFile'],
    filters: [{ name: 'ZIP-архив', extensions: ['zip'] }]
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
  if (!currentProjectRoot) throw new Error('Проект не загружен');
  return readUtf8(normalizePath(currentProjectRoot, relativePath));
});

ipcMain.handle('project:write-file', async (_event, relativePath, content) => {
  if (!currentProjectRoot) throw new Error('Проект не загружен');
  await fs.writeFile(normalizePath(currentProjectRoot, relativePath), content, 'utf8');
  return { ok: true };
});

ipcMain.handle('project:replace-asset', async (_event, { targetRelativePath, sourceAbsolutePath }) => {
  if (!currentProjectRoot) throw new Error('Проект не загружен');
  const destination = normalizePath(currentProjectRoot, targetRelativePath);
  await fs.copyFile(sourceAbsolutePath, destination);
  return { ok: true };
});

ipcMain.handle('project:search', async (_event, query) => {
  if (!currentProjectRoot) throw new Error('Проект не загружен');
  if (!query || !query.trim()) return [];
  return findInProject(currentProjectRoot, query.trim());
});

app.whenReady().then(async () => {
  app.setName('Hyeta визуальный редактор');
  registerApplicationMenu();
  registerAppFsProtocol();
  lockDownPreviewNetwork();
  await createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
// updated-all-files
