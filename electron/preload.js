const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  selectProject: () => ipcRenderer.invoke('select-project'),
  onProjectRoot: (cb) => ipcRenderer.on('project-root', (_e, path) => cb(path)),
  platform: process.platform,
});

contextBridge.exposeInMainWorld('__PROJECT_ROOT__', '');
