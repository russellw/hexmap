const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let currentFilePath = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.maximize();
  updateWindowTitle();

  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Map',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            currentFilePath = null;
            updateWindowTitle();
            mainWindow.webContents.send('new-map');
          }
        },
        {
          label: 'Open Map',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Hex Map Files', extensions: ['hexmap'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });
            
            if (!result.canceled) {
              const filePath = result.filePaths[0];
              const data = fs.readFileSync(filePath, 'utf8');
              currentFilePath = filePath;
              updateWindowTitle();
              mainWindow.webContents.send('load-map', JSON.parse(data), filePath);
            }
          }
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: async () => {
            if (currentFilePath) {
              mainWindow.webContents.send('save-map', currentFilePath);
            } else {
              mainWindow.webContents.send('save-as-map');
            }
          }
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: async () => {
            mainWindow.webContents.send('save-as-map');
          }
        },
        { type: 'separator' },
        {
          label: 'Resize Map...',
          click: () => {
            mainWindow.webContents.send('show-resize-dialog');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function updateWindowTitle() {
  const filename = currentFilePath ? path.basename(currentFilePath) : 'Untitled';
  mainWindow.setTitle(`Hexmap - ${filename}`);
}

ipcMain.handle('save-map-dialog', async (event, mapData) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Hex Map Files', extensions: ['hexmap'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled) {
    fs.writeFileSync(result.filePath, JSON.stringify(mapData, null, 2));
    currentFilePath = result.filePath;
    updateWindowTitle();
    return { success: true, filePath: result.filePath };
  }
  return { success: false };
});

ipcMain.handle('save-map-direct', async (event, mapData, filePath) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(mapData, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.on('update-title', (event, filePath) => {
  currentFilePath = filePath;
  updateWindowTitle();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});