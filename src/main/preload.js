const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('editorApi', {
  openProject: () => ipcRenderer.invoke('project:open'),
  openProjectZip: () => ipcRenderer.invoke('project:open-zip'),
  readFile: (relativePath) => ipcRenderer.invoke('project:read-file', relativePath),
  writeFile: (relativePath, content) => ipcRenderer.invoke('project:write-file', relativePath, content),
  search: (query) => ipcRenderer.invoke('project:search', query),
  replaceAsset: (payload) => ipcRenderer.invoke('project:replace-asset', payload),
  pickAssetFile: async () => {
    // no native dialog in preload for now, renderer uses input type=file
    return null;
  }
});
