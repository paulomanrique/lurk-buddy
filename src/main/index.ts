import { app, BrowserWindow, nativeImage } from 'electron';
import { join } from 'node:path';
import { APP_NAME, BRAND_PRIMARY } from '../shared/constants.js';
import { AppContext } from './app-context.js';

let mainWindow: BrowserWindow | null = null;
let appContext: AppContext | null = null;

function createWindow(): BrowserWindow {
  const icon = nativeImage.createFromPath(join(process.cwd(), 'src/renderer/assets/logo-circle.svg'));
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: BRAND_PRIMARY,
    title: APP_NAME,
    icon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(join(process.cwd(), 'dist/renderer/index.html'));
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
