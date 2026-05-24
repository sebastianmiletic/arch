const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

// Fix GPU sandbox crash on unsigned macOS apps
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');

let win;
let backend;

const isDev = !app.isPackaged;

// Logging to user data dir for debugging packaged app issues
const logDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, `main-${Date.now()}.log`);
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(logFile, line); } catch {}
  if (isDev) console.log(line.trim());
}

function getServerDir() {
  if (isDev) {
    return path.join(__dirname, 'server');
  }
  // In packaged app, extraResources are in Contents/Resources
  return path.join(process.resourcesPath, 'server');
}

function waitForBackend(cb, retries = 60) {
  log(`waitForBackend: ${retries} retries left`);
  const req = http.get('http://localhost:3000/api/health', { timeout: 500 }, (res) => {
    if (res.statusCode === 200) {
      log('Backend health check passed');
      return cb();
    }
    if (retries > 0) setTimeout(() => waitForBackend(cb, retries - 1), 500);
    else {
      log('Backend health check failed: out of retries');
      cb(new Error('Backend failed to start'));
    }
  });
  req.on('error', (err) => {
    log(`Health check error: ${err.message || 'unknown'}`);
    if (retries > 0) setTimeout(() => waitForBackend(cb, retries - 1), 500);
    else {
      log('Backend health check failed: out of retries');
      cb(new Error('Backend failed to start'));
    }
  });
  req.setTimeout(500);
}

app.whenReady().then(async () => {
  log('App ready');
  const serverDir = getServerDir();
  const serverDist = path.join(serverDir, 'dist', 'server.js');
  log(`Server dir: ${serverDir}`);
  log(`Server dist: ${serverDist}`);
  log(`__dirname: ${__dirname}`);
  log(`resourcesPath: ${process.resourcesPath}`);

  if (!isDev) {
    const nmPath = path.join(serverDir, 'node_modules');
    if (!fs.existsSync(nmPath)) {
      log('Server node_modules missing');
    } else {
      log('Server node_modules found');
    }
  }

  if (!fs.existsSync(serverDist)) {
    log(`FATAL: Server build not found at ${serverDist}`);
    app.quit();
    return;
  }

  // Use userData for DB so it's writable even in /Applications
  const dbDir = app.getPath('userData');
  log(`DB dir: ${dbDir}`);

  backend = spawn('node', ['dist/server.js'], {
    cwd: serverDir,
    stdio: 'inherit',
    env: { ...process.env, DB_PATH: path.join(dbDir, 'studio.db') },
  });

  backend.on('error', (err) => {
    log(`Backend spawn error: ${err.message}`);
  });

  backend.on('exit', (code) => {
    log(`Backend exited with code ${code}`);
  });

  log('Waiting for backend...');
  waitForBackend((err) => {
    if (err) {
      log(`Backend failed: ${err.message}`);
    }

    log('Creating BrowserWindow...');
    win = new BrowserWindow({
      width: 1440,
      height: 900,
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
      log('Window ready-to-show');
      win.show();
      win.focus();
    });

    win.on('closed', () => {
      log('Window closed');
      win = null;
    });

    if (isDev) win.webContents.openDevTools();

    log('Loading http://localhost:3000');
    win.loadURL('http://localhost:3000').then(() => {
      log('URL loaded successfully');
    }).catch((err) => {
      log(`Failed to load URL: ${err.message}`);
    });
  });
});

app.on('window-all-closed', () => {
  log('window-all-closed');
  if (backend) backend.kill();
  app.quit();
});

app.on('before-quit', () => {
  log('before-quit');
  if (backend) backend.kill();
});
