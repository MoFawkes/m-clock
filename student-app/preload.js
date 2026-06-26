'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Minimal, safe bridge for the config form.
contextBridge.exposeInMainWorld('mclock', {
  getConfig: () => ipcRenderer.invoke('mclock:get-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('mclock:save-config', cfg),
  openExternal: (url) => ipcRenderer.invoke('mclock:open-external', url),
});
