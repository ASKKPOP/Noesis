/**
 * Local Nous Manager — Electron main process (Tier 1, D-V3-36).
 *
 * Owns everything privileged so the renderer stays dumb + sandboxed:
 *  - BrainProcessManager: spawn/stop `python -m noesis_brain`, buffer logs.
 *  - Brain API client: HTTP to the Brain's local server with X-Brain-Secret.
 *    The secret lives HERE (settings.json in userData) — never in renderer JS.
 *  - Brain YAML config file read/write.
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Settings (persisted in userData/settings.json) ─────────────────────────
const DEFAULTS = {
  brainDir: '',            // repo's brain/ directory (cwd for the process)
  pythonPath: '.venv/bin/python', // relative to brainDir or absolute
  configPath: '',          // Nous YAML (e.g. brain/data/nous/sophia.yaml)
  httpPort: 8090,
  httpSecret: '',
  extraEnv: {},            // e.g. { GRID_URL: "http://localhost:8080" }
};

function settingsFile() {
  return path.join(app.getPath('userData'), 'settings.json');
}
function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}
function saveSettings(s) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2));
  return s;
}

// ── BrainProcessManager ─────────────────────────────────────────────────────
const MAX_LOG_LINES = 2000;
let brainProc = null;
let logBuf = [];

function pushLog(line) {
  logBuf.push(line);
  if (logBuf.length > MAX_LOG_LINES) logBuf = logBuf.slice(-MAX_LOG_LINES);
}

function brainStatus() {
  return { running: brainProc !== null, pid: brainProc ? brainProc.pid : null };
}

function startBrain(settings) {
  if (brainProc) return { ok: false, error: 'already_running' };
  const { brainDir, pythonPath, configPath, httpPort, httpSecret, extraEnv } = settings;
  if (!brainDir) return { ok: false, error: 'brainDir not set' };
  const py = path.isAbsolute(pythonPath) ? pythonPath : path.join(brainDir, pythonPath);
  if (!fs.existsSync(py)) return { ok: false, error: `python not found: ${py}` };
  const env = {
    ...process.env,
    BRAIN_HTTP_SECRET: httpSecret,
    BRAIN_HTTP_PORT: String(httpPort),
    // Explicit config path beats cwd-relative resolution (fragile across shells).
    ...(configPath ? { NOUS_CONFIG: configPath } : {}),
    ...extraEnv,
  };
  logBuf = [];
  pushLog(`[lnm] starting: ${py} -m noesis_brain (cwd=${brainDir})`);
  brainProc = spawn(py, ['-m', 'noesis_brain'], { cwd: brainDir, env });
  brainProc.stdout.on('data', (d) => String(d).split('\n').filter(Boolean).forEach(pushLog));
  brainProc.stderr.on('data', (d) => String(d).split('\n').filter(Boolean).forEach(pushLog));
  brainProc.on('exit', (code, sig) => {
    pushLog(`[lnm] brain exited code=${code} signal=${sig ?? ''}`);
    brainProc = null;
  });
  return { ok: true, pid: brainProc.pid };
}

function stopBrain() {
  if (!brainProc) return { ok: false, error: 'not_running' };
  pushLog('[lnm] stopping brain (SIGTERM)…');
  brainProc.kill('SIGTERM');
  return { ok: true };
}

// ── Brain API client (main-process fetch; secret never leaves main) ────────
async function brainApi(settings, route) {
  const url = `http://127.0.0.1:${settings.httpPort}${route}`;
  try {
    const resp = await fetch(url, { headers: { 'X-Brain-Secret': settings.httpSecret } });
    if (!resp.ok) return { ok: false, status: resp.status, error: await resp.text() };
    return { ok: true, status: resp.status, data: await resp.json() };
  } catch (e) {
    return { ok: false, status: 0, error: String(e && e.message ? e.message : e) };
  }
}

// ── IPC surface ─────────────────────────────────────────────────────────────
ipcMain.handle('settings:get', () => loadSettings());
ipcMain.handle('settings:save', (_e, s) => saveSettings({ ...loadSettings(), ...s }));

ipcMain.handle('brain:start', () => startBrain(loadSettings()));
ipcMain.handle('brain:stop', () => stopBrain());
ipcMain.handle('brain:status', () => brainStatus());
ipcMain.handle('brain:logs', () => logBuf.slice(-400));

// Only allowlisted GET routes cross this bridge — the renderer cannot craft URLs.
const API_ROUTES = {
  state: '/local/state',
  memory: '/local/memory/recent?limit=100',
  wiki: '/local/wiki/pages',
  aiStatus: '/local-ai/status',
  aiModels: '/local-ai/models',
};
ipcMain.handle('api:get', (_e, key) => {
  const route = API_ROUTES[key];
  if (!route) return { ok: false, status: 0, error: `unknown route key: ${key}` };
  return brainApi(loadSettings(), route);
});

ipcMain.handle('config:read', () => {
  const { configPath } = loadSettings();
  if (!configPath) return { ok: false, error: 'configPath not set' };
  try {
    return { ok: true, path: configPath, text: fs.readFileSync(configPath, 'utf8') };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
});
ipcMain.handle('config:write', (_e, text) => {
  const { configPath } = loadSettings();
  if (!configPath) return { ok: false, error: 'configPath not set' };
  try {
    fs.copyFileSync(configPath, `${configPath}.bak`); // one-step undo
    fs.writeFileSync(configPath, text);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
});

// ── Window ──────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 800,
    title: 'Local Nous Manager',
    backgroundColor: '#faf9f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const devUrl = process.env.LNM_DEV_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  stopBrain();
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
