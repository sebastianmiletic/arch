const { app, BrowserWindow, screen, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');

// Fix GPU sandbox crash on unsigned macOS apps
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Find Node.js binary: check common paths, then fallback to PATH
function findNodeBinary() {
  const candidates = [
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
    path.join(os.homedir(), '.nvm/versions/node/v22.15.0/bin/node'),
    path.join(os.homedir(), '.nvm/versions/node/v20.0.0/bin/node'),
    path.join(os.homedir(), '.n/bin/node'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'node'; // fallback to PATH
}

const NODE_BIN = findNodeBinary();

// Find OpenCode binary: check common paths, then fallback to PATH
function findOpencodeBinary() {
  const candidates = [
    '/opt/homebrew/bin/opencode',
    '/usr/local/bin/opencode',
    path.join(os.homedir(), '.local/bin/opencode'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'opencode'; // fallback to PATH
}

const OPENCODE_BIN = findOpencodeBinary();

// IPC: project directory selector
ipcMain.handle('select-project', async () => {
  if (!win) return { canceled: true };
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Select Project Directory',
  });
  return result;
});

// Force single instance: second launch focuses the existing window
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('Arch is already running. Focusing existing window...');
  app.quit();
  process.exit(0);
}

let win;
let backend;

const isDev = !app.isPackaged;

// Logging
const logDir = path.join(app.getPath('userData'), 'logs');
try { if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true }); } catch {}
const logFile = path.join(logDir, `main-${Date.now()}.log`);
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(logFile, line); } catch {}
  if (isDev) console.log(line.trim());
}

// Second instance launched (e.g. from Spotlight) — focus or recreate window
app.on('second-instance', (_event, _argv, _workingDirectory) => {
  log('second-instance event fired');
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    log('Focused existing window');
  } else {
    log('No existing window — recreating');
    createWindow();
  }
});

function getServerDir() {
  if (isDev) return path.join(__dirname, 'server');
  // In packaged app, extraResources are in Contents/Resources
  // For asar: false, they're in app.asar.unpacked if asar: true, but we prefer asar: false
  return path.join(process.resourcesPath, 'server');
}

function waitForBackend(cb, retries = 60) {
  const req = http.get('http://localhost:3000/api/health', { timeout: 500 }, (res) => {
    if (res.statusCode === 200) return cb();
    if (retries > 0) setTimeout(() => waitForBackend(cb, retries - 1), 500);
    else cb(new Error('Backend failed to start'));
  });
  req.on('error', () => {
    if (retries > 0) setTimeout(() => waitForBackend(cb, retries - 1), 500);
    else cb(new Error('Backend failed to start'));
  });
  req.setTimeout(500);
}

function getSafeWindowBounds() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
  const winW = 1440;
  const winH = 900;
  const x = Math.max(0, Math.min(100, screenW - winW));
  const y = Math.max(0, Math.min(100, screenH - winH));
  return { x, y, width: winW, height: winH };
}

function createWindow() {
  const bounds = getSafeWindowBounds();
  log(`Creating window at ${JSON.stringify(bounds)}`);
  
  win = new BrowserWindow({
    ...bounds,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#08080a',
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron', 'preload.js'),
    },
  });

  win.on('ready-to-show', () => {
    win.show();
    win.focus();
  });

  win.on('closed', () => {
    win = null;
  });

  if (isDev) win.webContents.openDevTools();

  log('Loading http://localhost:3000');
  win.loadURL('http://localhost:3000').then(() => {
    log('URL loaded successfully');
  }).catch((err) => {
    log(`Failed to load URL: ${err.message}`);
  });
}

function startBackend() {
  const serverDir = getServerDir();
  const serverDist = path.join(serverDir, 'dist', 'server.js');
  
  if (!fs.existsSync(serverDist)) {
    log(`FATAL: Server build not found at ${serverDist}`);
    app.quit();
    return;
  }
  
  // Check if node_modules exist. If not, fallback to copying from source
  const serverNM = path.join(serverDir, 'node_modules');
  const sourceNM = path.join(__dirname, '..', '..', 'server', 'node_modules'); // Relative to app in dev
  
  log(`serverDir: ${serverDir}`);
  log(`serverDist: ${serverDist}`);
  log(`node_modules at serverDir: ${fs.existsSync(serverNM)}`);

  const dbDir = app.getPath('userData');
  log(`DB dir: ${dbDir}`);

  // Capture user's shell PATH so opencode, ollama, etc. are available
  let userPath = process.env.PATH || '';
  try {
    const shell = process.env.SHELL || '/bin/zsh';
    const shellEnv = require('child_process').execSync(`${shell} -ilc 'echo $PATH'`, { encoding: 'utf-8', timeout: 3000 }).trim();
    if (shellEnv) userPath = shellEnv;
  } catch {}

  backend = spawn(NODE_BIN, ['dist/server.js'], {
    cwd: serverDir,
    stdio: 'inherit',
    env: { ...process.env, PATH: userPath, DB_PATH: path.join(dbDir, 'studio.db'), OPENCODE_BIN },
  });

  backend.on('error', (err) => log(`Backend spawn error: ${err.message}`));
  backend.on('exit', (code) => log(`Backend exited with code ${code}`));
}

app.whenReady().then(() => {
  log('App ready');
  log(`__dirname: ${__dirname}`);
  log(`resourcesPath: ${process.resourcesPath}`);

  startBackend();

  log('Waiting for backend...');
  waitForBackend((err) => {
    if (err) {
      log(`Backend failed: ${err.message}`);
    } else {
      log('Backend health check passed');
    }
    createWindow();
  });
});

app.on('window-all-closed', () => {
  if (backend) backend.kill();
  app.quit();
});

app.on('before-quit', () => {
  if (backend) backend.kill();
});
