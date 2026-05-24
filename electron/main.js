const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let backendProcess;
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 10 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#08080a',
    show: false,
  });

  // Wait for backend before showing
  waitForBackend(() => {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function waitForBackend(cb, retries = 40) {
  const req = http.get('http://localhost:3000/api/health', (res) => {
    if (res.statusCode === 200) return cb();
    if (retries > 0) setTimeout(() => waitForBackend(cb, retries - 1), 250);
  });
  req.on('error', () => {
    if (retries > 0) setTimeout(() => waitForBackend(cb, retries - 1), 250);
  });
  req.setTimeout(300);
}

function startBackend() {
  const projectRoot = path.join(__dirname, '..');
  const serverDir = path.join(projectRoot, 'server');

  if (isDev) {
    backendProcess = spawn('npx', ['tsx', 'src/server.ts'], {
      cwd: serverDir,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' },
    });
  } else {
    backendProcess = spawn(process.execPath, ['dist/server.js'], {
      cwd: serverDir,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
    });
  }
}

function buildMenu() {
  const template = [
    {
      label: 'AI Terminal Studio',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Project...',
          accelerator: 'Cmd+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow?.webContents?.send('project-root', result.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  startBackend();
  createWindow();
  buildMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) { try { backendProcess.kill(); } catch {} }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) { try { backendProcess.kill(); } catch {} }
});

// IPC handlers
ipcMain.handle('select-project', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});
