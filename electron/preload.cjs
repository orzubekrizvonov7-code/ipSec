const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipsecAPI', {
  checkAdmin: () => ipcRenderer.invoke('check-admin'),

  applyIpsec: (config) => ipcRenderer.invoke('apply-ipsec', config),
  checkIpsec: () => ipcRenderer.invoke('check-ipsec'),
  removeIpsec: () => ipcRenderer.invoke('remove-ipsec'),

  saveServerPackage: (config) => ipcRenderer.invoke('save-server-package', config),
  loadClientPackage: () => ipcRenderer.invoke('load-client-package'),

  runPing: (ip) => ipcRenderer.invoke('run-ping', ip),
  checkIPConfig: () => ipcRenderer.invoke('check-ipconfig'),
  checkGateway: () => ipcRenderer.invoke('check-gateway'),
  checkTunnel: () => ipcRenderer.invoke('check-tunnel'),

  startSocketServer: (port) => ipcRenderer.invoke('start-socket-server', port),
  connectSocketClient: (host, port) => ipcRenderer.invoke('connect-socket-client', host, port),
  sendChatMessage: (message) => ipcRenderer.invoke('send-chat-message', message),
  sendFileToPeer: (role) => ipcRenderer.invoke('send-file-to-peer', role),
  disconnectSocket: () => ipcRenderer.invoke('disconnect-socket'),

  onSocketStatus: (callback) => ipcRenderer.on('socket-status', (_e, data) => callback(data)),
  onChatMessage: (callback) => ipcRenderer.on('chat-message', (_e, data) => callback(data)),
  onFileReceived: (callback) => ipcRenderer.on('file-received', (_e, data) => callback(data)),
});