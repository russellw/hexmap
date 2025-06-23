const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

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

  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Map',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
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
              mainWindow.webContents.send('load-map', JSON.parse(data));
            }
          }
        },
        {
          label: 'Save Map',
          accelerator: 'CmdOrCtrl+S',
          click: async () => {
            mainWindow.webContents.send('save-map');
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

ipcMain.handle('save-map-dialog', async (event, mapData) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Hex Map Files', extensions: ['hexmap'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled) {
    fs.writeFileSync(result.filePath, JSON.stringify(mapData, null, 2));
    return { success: true };
  }
  return { success: false };
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