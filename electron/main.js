const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { fileURLToPath } = require('url');
const { initDb } = require('./db/schema');
const { registerChatHandlers } = require('./ipc/chat');
const { registerConversationHandlers } = require('./ipc/conversations');
const { registerProviderHandlers } = require('./ipc/providers');
const { registerMcpHandlers } = require('./ipc/mcp');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#101419',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:') {
        shell.openExternal(parsed.toString()).catch((err) => console.warn('Unable to open external URL:', err.message));
      }
    } catch (err) {
      console.warn('Blocked invalid external URL:', err.message);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    let allowed = false;
    try {
      const target = new URL(url);
      if (isDev) allowed = target.origin === 'http://localhost:5173';
      else allowed = target.protocol === 'file:' && path.resolve(fileURLToPath(target)) === path.resolve(__dirname, '../dist/index.html');
    } catch { /* malformed navigation is blocked */ }
    if (!allowed) event.preventDefault();
  });

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
}

app.whenReady().then(() => {
  const db = initDb();
  const secureIpcMain = {
    handle(channel, handler) {
      ipcMain.handle(channel, (event, ...args) => {
        const win = mainWindow;
        if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) {
          throw new Error(`Blocked IPC request from an untrusted renderer: ${channel}`);
        }
        return handler(event, ...args);
      });
    },
  };
  registerConversationHandlers(secureIpcMain, db);
  registerProviderHandlers(secureIpcMain, db);
  registerChatHandlers(secureIpcMain, db, () => mainWindow);
  registerMcpHandlers(secureIpcMain, db, () => mainWindow);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}).catch((error) => {
  console.error('NeverDrop startup error:', error);
  dialog.showErrorBox('NeverDrop could not start',
    `The local database could not be initialized. Your existing records have not been deleted.\n\n${error.message}`);
  app.quit();
});

app.on('before-quit', () => {
  require('./ipc/mcp').shutdownMcpServers().catch((err) => console.error('MCP shutdown failed:', err));
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
