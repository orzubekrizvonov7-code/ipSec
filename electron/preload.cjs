const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipsecAPI', {
  checkAdmin: () => ipcRenderer.invoke('check-admin'),
  apply: (config) => ipcRenderer.invoke('apply-ipsec', config),
  check: () => ipcRenderer.invoke('check-ipsec'),
  remove: () => ipcRenderer.invoke('remove-ipsec')
});