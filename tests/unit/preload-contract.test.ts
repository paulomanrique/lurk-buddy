import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '../../src/shared/ipc';

const invoke = vi.fn();
const on = vi.fn();
const removeListener = vi.fn();
const exposeInMainWorld = vi.fn();

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld
  },
  ipcRenderer: {
    invoke,
    on,
    removeListener
  }
}));

describe('preload contract', () => {
  beforeEach(() => {
    vi.resetModules();
    invoke.mockReset();
    on.mockReset();
    removeListener.mockReset();
    exposeInMainWorld.mockReset();
  });

  it('exposes updater methods over IPC', async () => {
    await import('../../src/preload/index');

    const [, api] = exposeInMainWorld.mock.calls[0];
    await api.app.updaterState();
    await api.app.checkForUpdates();
    await api.app.installUpdate();
    await api.app.openLatestRelease();

    expect(invoke).toHaveBeenNthCalledWith(1, IPC_CHANNELS.appUpdaterState);
    expect(invoke).toHaveBeenNthCalledWith(2, IPC_CHANNELS.appCheckForUpdates);
    expect(invoke).toHaveBeenNthCalledWith(3, IPC_CHANNELS.appInstallUpdate);
    expect(invoke).toHaveBeenNthCalledWith(4, IPC_CHANNELS.appOpenLatestRelease);
  });
});
