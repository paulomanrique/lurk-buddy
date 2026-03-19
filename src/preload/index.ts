import * as electron from 'electron';
import { IPC_CHANNELS, type LurkBuddyApi } from '../shared/ipc.js';

const { contextBridge, ipcRenderer } = electron;

function installFocusSpoof(): void {
  const injectIntoPageContext = () => {
    const script = document.createElement('script');
    script.textContent = `
      (() => {
        const redefine = (target, key, getter) => {
          try {
            Object.defineProperty(target, key, {
              configurable: true,
              enumerable: false,
              get: getter
            });
          } catch {}
        };

        redefine(Document.prototype, 'hidden', () => false);
        redefine(document, 'hidden', () => false);
        redefine(Document.prototype, 'visibilityState', () => 'visible');
        redefine(document, 'visibilityState', () => 'visible');
        document.hasFocus = () => true;

        const blockedEvents = new Set(['visibilitychange', 'webkitvisibilitychange', 'blur', 'focusout', 'pagehide']);
        const patchAddEventListener = (target) => {
          const original = target.addEventListener.bind(target);
          target.addEventListener = (type, listener, options) => {
            if (blockedEvents.has(type)) {
              return;
            }
            return original(type, listener, options);
          };
        };

        patchAddEventListener(document);
        patchAddEventListener(window);

        const pulseFocus = () => {
          window.dispatchEvent(new Event('focus'));
          window.dispatchEvent(new Event('pageshow'));
          document.dispatchEvent(new Event('visibilitychange'));
          document.dispatchEvent(new Event('focusin'));
        };

        pulseFocus();
        setInterval(pulseFocus, 1500);
      })();
    `;
    (document.documentElement ?? document.head ?? document.body)?.appendChild(script);
    script.remove();
  };

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

  if (document.documentElement) {
    injectIntoPageContext();
  } else {
    window.addEventListener('DOMContentLoaded', injectIntoPageContext, { once: true });
  }
}

installFocusSpoof();

const api: LurkBuddyApi = {
  channels: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.channelsList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.channelsCreate, input),
    update: (id, patch) => ipcRenderer.invoke(IPC_CHANNELS.channelsUpdate, id, patch),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.channelsDelete, id),
    toggle: (id, enabled) => ipcRenderer.invoke(IPC_CHANNELS.channelsToggle, id, enabled),
    test: (id) => ipcRenderer.invoke(IPC_CHANNELS.channelsTest, id),
    export: () => ipcRenderer.invoke(IPC_CHANNELS.channelsExport),
    import: () => ipcRenderer.invoke(IPC_CHANNELS.channelsImport)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    update: (patch) => ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, patch)
  },
  lives: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.livesList),
    activate: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.livesActivate, sessionId),
    close: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.livesClose, sessionId),
    setMuted: (sessionId, muted) => ipcRenderer.invoke(IPC_CHANNELS.livesSetMuted, sessionId, muted),
    layout: (sessionId, bounds) => ipcRenderer.invoke(IPC_CHANNELS.livesLayout, sessionId, bounds)
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
    },
    runNow: () => ipcRenderer.invoke(IPC_CHANNELS.appRunNow)
  }
};

contextBridge.exposeInMainWorld('lurkBuddy', api);
