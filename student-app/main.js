'use strict';

/*
 * m-clock Student — a small always-on-top desktop app.
 *
 * On first run it asks for the server address (the main computer's m-clock URL)
 * and which group the user is in (full-time / part-time / teacher). After that
 * it simply loads the server's compact widget page, which connects over SSE and
 * rings + shows a notification whenever the teacher fires an alert for that
 * group. All the real logic lives on the server, so this app stays tiny.
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (e) { return {}; }
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

let win = null;
let tray = null;

function widgetUrl(cfg) {
  const base = String(cfg.serverUrl || '').replace(/\/$/, '');
  const group = encodeURIComponent(cfg.group || 'all');
  return `${base}/widget?group=${group}`;
}

function createWindow() {
  win = new BrowserWindow({
    width: 360,
    height: 540,
    minWidth: 300,
    minHeight: 360,
    alwaysOnTop: true,
    title: 'm-clock Student',
    backgroundColor: '#0c1b38',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.removeMenu();
  routeWindow();
  win.on('closed', () => { win = null; });
}

// Show the config form, or the live widget if we already have a server URL.
function routeWindow() {
  const cfg = loadConfig();
  if (cfg.serverUrl) {
    win.loadURL(widgetUrl(cfg)).catch(() => win.loadFile('config.html'));
  } else {
    win.loadFile('config.html');
  }
}

function buildTray() {
  try {
    tray = new Tray(path.join(__dirname, 'tray.png'));
  } catch (e) {
    return; // no tray icon available; skip silently
  }
  const menu = Menu.buildFromTemplate([
    { label: 'Show', click: () => { if (win) { win.show(); win.focus(); } else createWindow(); } },
    { label: 'Always on top', type: 'checkbox', checked: true, click: (i) => win && win.setAlwaysOnTop(i.checked) },
    { label: 'Change server / group…', click: () => { if (!win) createWindow(); win.loadFile('config.html'); } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setToolTip('m-clock Student');
  tray.setContextMenu(menu);
  tray.on('click', () => { if (win) win.show(); else createWindow(); });
}

// Save settings from the config form, then load the live widget.
ipcMain.handle('mclock:get-config', () => loadConfig());
ipcMain.handle('mclock:save-config', (_e, cfg) => {
  saveConfig({ serverUrl: String(cfg.serverUrl || '').trim(), group: cfg.group || 'all' });
  if (win) routeWindow();
  return true;
});
ipcMain.handle('mclock:open-external', (_e, url) => shell.openExternal(url));

app.whenReady().then(() => {
  createWindow();
  buildTray();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

// Keep running in the tray when the window is closed (don't quit on macOS).
app.on('window-all-closed', () => { /* stay alive in tray */ });
