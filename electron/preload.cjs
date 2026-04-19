const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipsecAPI', {
  checkAdmin: () => ipcRenderer.invoke('check-admin'),
  apply: (config) => ipcRenderer.invoke('apply-ipsec', config),
  check: () => ipcRenderer.invoke('check-ipsec'),
  remove: () => ipcRenderer.invoke('remove-ipsec'),

  runPing: (ip) => ipcRenderer.invoke('run-ping', ip),
  checkIPConfig: () => ipcRenderer.invoke('check-ipconfig'),
  checkGateway: () => ipcRenderer.invoke('check-gateway'),
  checkTunnel: () => ipcRenderer.invoke('check-tunnel'),

  saveClientConfig: (config) => ipcRenderer.invoke('save-client-config', config),
  loadClientConfig: () => ipcRenderer.invoke('load-client-config')
});