const { ipcMain, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

let socketServer = null;
let socketClient = null;
let connectedPeer = null;

function resetSockets() {
  try {
    if (socketClient) socketClient.close();
  } catch {}
  try {
    if (socketServer) socketServer.close();
  } catch {}

  socketClient = null;
  socketServer = null;
  connectedPeer = null;
}

function ensureReceiveDir() {
  const saveDir = path.join(app.getPath('downloads'), 'IPSecWizard_Received');
  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir, { recursive: true });
  }
  return saveDir;
}

function saveIncomingFile(meta, data, event) {
  if (!meta) return;

  const saveDir = ensureReceiveDir();
  const safeName = path.basename(meta.name || 'received_file.bin');
  const savePath = path.join(saveDir, safeName);

  const fileBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  fs.writeFileSync(savePath, fileBuffer);

  event.sender.send('file-received', {
    from: meta.from,
    name: safeName,
    size: fileBuffer.length,
    path: savePath
  });
}

function registerRealtimeHandlers() {
  ipcMain.handle('start-socket-server', async (event, port = 9001) => {
    try {
      if (socketServer) {
        return { ok: true, output: `Socket server allaqachon ishga tushgan: ${port}` };
      }

      socketServer = new WebSocket.Server({
        host: '0.0.0.0',
        port: Number(port)
      });

      socketServer.on('connection', (ws, req) => {
        connectedPeer = ws;
        ws._incomingFileMeta = null;

        event.sender.send('socket-status', {
          type: 'connected',
          message: `Client ulanib oldi: ${req.socket.remoteAddress}`
        });

        ws.on('message', (data, isBinary) => {
          if (!isBinary) {
            try {
              const parsed = JSON.parse(data.toString());

              if (parsed.type === 'chat') {
                event.sender.send('chat-message', parsed);
              } else if (parsed.type === 'file-meta') {
                ws._incomingFileMeta = parsed;
              }
            } catch (err) {
              event.sender.send('socket-status', {
                type: 'error',
                message: `Xabar parse xatosi: ${err.message}`
              });
            }
          } else {
            const meta = ws._incomingFileMeta;
            if (!meta) return;

            try {
              saveIncomingFile(meta, data, event);
            } catch (err) {
              event.sender.send('socket-status', {
                type: 'error',
                message: `Fayl saqlash xatosi: ${err.message}`
              });
            } finally {
              ws._incomingFileMeta = null;
            }
          }
        });

        ws.on('close', () => {
          connectedPeer = null;
          event.sender.send('socket-status', {
            type: 'disconnected',
            message: 'Client uzildi'
          });
        });

        ws.on('error', (err) => {
          event.sender.send('socket-status', {
            type: 'error',
            message: `Server socket xatosi: ${err.message}`
          });
        });
      });

      return { ok: true, output: `Socket server ishga tushdi: ${port}` };
    } catch (err) {
      return { ok: false, output: err.message };
    }
  });

  ipcMain.handle('connect-socket-client', async (event, host, port = 9001) => {
    try {
      if (!host || !String(host).trim()) {
        return { ok: false, output: 'Server host kiritilmagan.' };
      }

      if (socketClient && socketClient.readyState === WebSocket.OPEN) {
        return { ok: true, output: `Socket client allaqachon ulangan: ${host}:${port}` };
      }

      socketClient = new WebSocket(`ws://${host}:${port}`);
      socketClient._incomingFileMeta = null;

      socketClient.on('open', () => {
        connectedPeer = socketClient;
        event.sender.send('socket-status', {
          type: 'connected',
          message: `Serverga ulanildi: ${host}:${port}`
        });
      });

      socketClient.on('message', (data, isBinary) => {
        if (!isBinary) {
          try {
            const parsed = JSON.parse(data.toString());

            if (parsed.type === 'chat') {
              event.sender.send('chat-message', parsed);
            } else if (parsed.type === 'file-meta') {
              socketClient._incomingFileMeta = parsed;
            }
          } catch (err) {
            event.sender.send('socket-status', {
              type: 'error',
              message: `Xabar parse xatosi: ${err.message}`
            });
          }
        } else {
          const meta = socketClient._incomingFileMeta;
          if (!meta) return;

          try {
            saveIncomingFile(meta, data, event);
          } catch (err) {
            event.sender.send('socket-status', {
              type: 'error',
              message: `Fayl saqlash xatosi: ${err.message}`
            });
          } finally {
            socketClient._incomingFileMeta = null;
          }
        }
      });

      socketClient.on('close', () => {
        connectedPeer = null;
        event.sender.send('socket-status', {
          type: 'disconnected',
          message: 'Server bilan aloqa uzildi'
        });
      });

      socketClient.on('error', (err) => {
        event.sender.send('socket-status', {
          type: 'error',
          message: `Client socket xatosi: ${err.message}`
        });
      });

      return { ok: true, output: `Ulanish boshlandi: ${host}:${port}` };
    } catch (err) {
      return { ok: false, output: err.message };
    }
  });

  ipcMain.handle('send-chat-message', async (_event, payload) => {
    try {
      if (!connectedPeer || connectedPeer.readyState !== WebSocket.OPEN) {
        return { ok: false, output: 'Socket ulanmagan.' };
      }

      connectedPeer.send(JSON.stringify({
        type: 'chat',
        from: payload.from,
        text: payload.text,
        time: payload.time
      }));

      return { ok: true, output: 'Xabar yuborildi.' };
    } catch (err) {
      return { ok: false, output: err.message };
    }
  });

  ipcMain.handle('send-file-to-peer', async (event, role) => {
    try {
      if (!connectedPeer || connectedPeer.readyState !== WebSocket.OPEN) {
        return { ok: false, output: 'Socket ulanmagan.' };
      }

      const result = await dialog.showOpenDialog({
        title: 'Fayl tanlang',
        properties: ['openFile']
      });

      if (result.canceled || !result.filePaths.length) {
        return { ok: false, output: 'Fayl tanlash bekor qilindi.' };
      }

      const filePath = result.filePaths[0];
      const fileBuffer = fs.readFileSync(filePath);
      const name = path.basename(filePath);

      connectedPeer.send(JSON.stringify({
        type: 'file-meta',
        from: role,
        name,
        size: fileBuffer.length
      }));

      connectedPeer.send(fileBuffer, { binary: true });

      event.sender.send('socket-status', {
        type: 'file-sent',
        message: `Fayl yuborildi: ${name}`
      });

      return { ok: true, output: `Fayl yuborildi: ${name}` };
    } catch (err) {
      return { ok: false, output: err.message };
    }
  });

  ipcMain.handle('disconnect-socket', async () => {
    resetSockets();
    return { ok: true, output: 'Socket aloqa yopildi.' };
  });
}

module.exports = { registerRealtimeHandlers };