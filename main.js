// main.js
// Electron Main Process Script for SR-AUDIT SYSTEM

const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  // Create the standalone desktop application browser window.
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    useContentSize: true,
    frame: true, // Native framing controls
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js') // Preload hook if needed
    }
  });

  // Load the root entry login page
  win.loadFile(path.join(__dirname, 'pages/login.html'));

  // Option to open DevTools for debugging (can be removed for production)
  // win.webContents.openDevTools();
}

// Lifecycle handler: initialize Electron BrowserWindow when ready
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Lifecycle handler: quit processes cleanly on Windows when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
