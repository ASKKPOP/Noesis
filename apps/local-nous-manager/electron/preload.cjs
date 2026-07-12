/** Preload — the ONLY bridge the renderer gets (contextIsolation on). */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lnm', {
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSave: (s) => ipcRenderer.invoke('settings:save', s),
  brainStart: () => ipcRenderer.invoke('brain:start'),
  brainStop: () => ipcRenderer.invoke('brain:stop'),
  brainStatus: () => ipcRenderer.invoke('brain:status'),
  brainLogs: () => ipcRenderer.invoke('brain:logs'),
  apiGet: (key) => ipcRenderer.invoke('api:get', key),
  configRead: () => ipcRenderer.invoke('config:read'),
  configWrite: (text) => ipcRenderer.invoke('config:write', text),
});
