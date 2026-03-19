import * as electron from 'electron';
import type { BrowserWindow as ElectronBrowserWindow } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { APP_NAME, BRAND_PRIMARY } from '../shared/constants.js';
import { AppContext } from './app-context.js';

const { app, BrowserWindow, nativeImage } = electron;
const mainPreloadPath = join(__dirname, '../preload/index.js');
let mainWindow: ElectronBrowserWindow | null = null;
let appContext: AppContext | null = null;

function resolveWindowIconPath(): string | null {
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, 'icons', 'app-icon.png')]
    : [
        join(process.cwd(), 'build', 'icon.png'),
        join(process.cwd(), 'src/renderer/assets/logo-circle.svg')
      ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveRendererEntryPath(): string {
  return app.isPackaged
    ? join(app.getAppPath(), 'dist/renderer/index.html')
    : join(process.cwd(), 'dist/renderer/index.html');
}

function createWindow(): ElectronBrowserWindow {
  const iconPath = resolveWindowIconPath();
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : undefined;
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: BRAND_PRIMARY,
    title: APP_NAME,
    icon,
    webPreferences: {
      preload: mainPreloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(resolveRendererEntryPath());
  }
  return window;
}

async function bootstrap(): Promise<void> {
  await app.whenReady();
  app.setName(APP_NAME);
  mainWindow = createWindow();
  appContext = new AppContext();
  appContext.registerIpc(mainWindow);
  appContext.polling.start(mainWindow);

  mainWindow.on('resize', () => {
    if (!appContext) {
      return;
    }
    const activeSessionId = appContext.sessions.active()[0]?.id;
    if (activeSessionId) {
      appContext.sessions.activate(activeSessionId);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

void bootstrap();
