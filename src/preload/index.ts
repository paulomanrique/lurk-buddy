import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type LurkBuddyApi } from '../shared/ipc.js';

function installFocusSpoof(): void {
  const redefine = <T>(target: T, key: PropertyKey, getter: () => unknown) => {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: false,
      get: getter
    });
  };

  redefine(document, 'hidden', () => false);
  redefine(document, 'visibilityState', () => 'visible');
  document.hasFocus = () => true;

  const blockedEvents = new Set(['visibilitychange', 'webkitvisibilitychange', 'blur', 'focusout', 'pagehide']);
  const originalAddEventListener = document.addEventListener.bind(document);
  document.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) => {
    if (blockedEvents.has(type)) {
      return;
    }
    originalAddEventListener(type, listener, options);
  }) as Document['addEventListener'];

  window.addEventListener('load', () => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

installFocusSpoof();

const api: LurkBuddyApi = {
  channels: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.channelsList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.channelsCreate, input),
    update: (id, patch) => ipcRenderer.invoke(IPC_CHANNELS.channelsUpdate, id, patch),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.channelsDelete, id),
    toggle: (id, enabled) => ipcRenderer.invoke(IPC_CHANNELS.channelsToggle, id, enabled),
    test: (id) => ipcRenderer.invoke(IPC_CHANNELS.channelsTest, id)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    update: (patch) => ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, patch)
  },
  lives: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.livesList),
    activate: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.livesActivate, sessionId),
    close: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.livesClose, sessionId)
  },
  logs: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.logsList)
  },
  app: {
    snapshot: () => ipcRenderer.invoke(IPC_CHANNELS.appSnapshot),
    onStateChanged: (callback) => {
      const listener = () => callback();
      ipcRenderer.on(IPC_CHANNELS.appStateChanged, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.appStateChanged, listener);
      };
    }
  }
};

contextBridge.exposeInMainWorld('lurkBuddy', api);
