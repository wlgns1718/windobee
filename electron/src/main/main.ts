/* eslint-disable promise/always-return */
/* eslint-disable global-require */
import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { Worker } from 'worker_threads';
import path from 'path';
import createMainWindow from './mainWindow';
import createSubWindow from './subWindow';
import createMenuWindow from './menuWindow';
import {
  interWindowCommunication,
  interMenuWindowCommunication,
} from './interWindow';
import { head } from 'lodash';

const { dbInstance } = require('./jobTimeDB');
const electron = require('electron');

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
let subWindow: BrowserWindow | null = null;
let menuWindow: BrowserWindow | null = null;
let isMenuOn = false;
// ipcMain.on('ipc-example', async (event, arg) => {
//   const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
//   console.log(msgTemplate(arg));
//   event.reply('ipc-example', msgTemplate('pong'));
// });

dbInstance.init();

ipcMain.on('test', async (event, arg) => {
  const result = await dbInstance.getAll();
  event.reply('test', result);
});

ipcMain.on('windowMoving', (event, arg) => {
  mainWindow?.setBounds({
    width: 100,
    height: 100,
    x: arg.mouseX - 50, //always changes in runtime
    y: arg.mouseY - 50,
  });
});

ipcMain.on('toggleMenu', async (event, arg) => {
  if (isMenuOn) {
    menuWindow?.hide();
    isMenuOn = false;
  } else {
    menuWindow?.show();
    mainWindow?.focus();
    isMenuOn = true;
  }
});

ipcMain.on('menuWindowSizeUp', () => {
  console.log('sizeup');
  menuWindow?.setBounds({
    width: 400,
    height: 400,
  });
});

setInterval(() => {
  console.log(menuWindow?.getBounds());
}, 2000);

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  mainWindow = createMainWindow(app);
  subWindow = createSubWindow(app);
  menuWindow = createMenuWindow(app);

  interWindowCommunication(mainWindow, subWindow);
  interMenuWindowCommunication(mainWindow, menuWindow);
  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      if (mainWindow === null) createWindow();
    });

    globalShortcut.register('CommandOrControl+Alt+I', () => {
      mainWindow?.webContents.toggleDevTools();
      subWindow?.webContents.toggleDevTools();
      menuWindow?.webContents.toggleDevTools();
    });
    globalShortcut.register('CommandOrControl+Alt+O', () => {
      subWindow?.webContents.send('sub', 'jobtime');
    });
  })
  .catch(console.log);

// 프로그램 시간 계산하기
const jobTimeThread = new Worker(path.join(__dirname, 'jobTime.js'));
