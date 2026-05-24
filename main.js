const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

let win;
let backend;

const isDev = !app.isPackaged;

function getServerDir() {
  if (isDev) {
    return path.join(__dirname, 'server');
  }
  // In packaged app, extraResources are in Contents/Resources
  return path.join(process.resourcesPath, 'server');
}

function waitForBackend(cb, retries = 40) {
  const req = http.get('http://localhost:3000/api/health', (res) => {
    if (res.statusCode === 200) return cb();
    if (retries > 0) setTimeout(() => waitForBackend(cb, retries - 1), 400);
  });
  req.on('error', () => {
    if (retries > 0) setTimeout(() => waitForBackend(cb, retries - 1), 400);
  });
  req.setTimeout(400);
}

app.whenReady().then(async () => {
  const serverDir = getServerDir();
  const serverDist = path.join(serverDir, 'dist', 'server.js');

  // Ensure dependencies are installed in production
  if (!isDev) {
    const nmPath = path.join(serverDir, 'node_modules');
    if (!fs.existsSync(nmPath)) {
      console.log('Installing server dependencies...');
      await new Promise((resolve, reject) => {
        const proc = spawn('npm', ['install', '--production'], {
          cwd: serverDir,
          stdio: 'inherit',
          shell: true,
        });
        proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('npm install failed'))));
      });
    }
  }

  if (!fs.existsSync(serverDist)) {
    console.error('Server build not found at:', serverDist);
    app.quit();
    return;
  }

  backend = spawn('node', ['dist/server.js'], { cwd: serverDir, stdio: 'inherit' });

  backend.on('error', (err) => {
    console.error('Backend spawn error:', err);
  });

  waitForBackend(() => {
    win = new BrowserWindow({
      width: 1440,
      height: 900,
      titleBarStyle: 'hiddenInset',
      backgroundColor: '#08080a',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'electron', 'preload.js'),
      },
    });

    if (isDev) win.webContents.openDevTools();

    win.loadURL('http://localhost:3000');
  });
});

app.on('window-all-closed', () => {
  if (backend) backend.kill();
  app.quit();
});
