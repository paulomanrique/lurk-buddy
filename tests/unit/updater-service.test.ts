import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdaterService, type UpdaterClient } from '../../src/main/updater-service';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.0.1'
  }
}));

vi.mock('electron-updater', () => ({
  autoUpdater: {}
}));

class MockUpdater extends EventEmitter implements UpdaterClient {
  autoDownload = false;
  autoInstallOnAppQuit = true;
  allowPrerelease = true;
  checkForUpdates = vi.fn().mockResolvedValue(undefined);
  quitAndInstall = vi.fn();
}

describe('UpdaterService', () => {
  let logs: { write: ReturnType<typeof vi.fn> };
  let updater: MockUpdater;

  beforeEach(() => {
    logs = { write: vi.fn() };
    updater = new MockUpdater();
  });

  it('stays idle and skips checks when the app is not packaged', async () => {
    const service = new UpdaterService(logs as never, {
      autoUpdater: updater,
      isPackaged: false,
      currentVersion: '1.0.0'
    });

    service.initialize();
    await service.checkForUpdates();

    expect(service.getState()).toEqual({
      enabled: false,
      status: 'idle',
      currentVersion: '1.0.0',
      availableVersion: null,
      downloadPercent: null,
      error: null
    });
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('tracks updater transitions and progress', () => {
    const service = new UpdaterService(logs as never, {
      autoUpdater: updater,
      isPackaged: true,
      currentVersion: '1.0.0'
    });

    service.initialize();
    updater.emit('checking-for-update');
    expect(service.getState().status).toBe('checking');

    updater.emit('update-available', { version: '1.1.0' });
    expect(service.getState()).toMatchObject({
      enabled: true,
      status: 'available',
      currentVersion: '1.0.0',
      availableVersion: '1.1.0',
      downloadPercent: 0,
      error: null
    });

    updater.emit('download-progress', { percent: 55.17 });
    expect(service.getState()).toMatchObject({
      status: 'downloading',
      availableVersion: '1.1.0',
      downloadPercent: 55.2
    });

    updater.emit('update-downloaded', { version: '1.1.0' });
    expect(service.getState()).toMatchObject({
      status: 'downloaded',
      availableVersion: '1.1.0',
      downloadPercent: 100
    });

    service.installUpdate();
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it('captures updater errors', async () => {
    const failure = new Error('network down');
    updater.checkForUpdates.mockRejectedValueOnce(failure);
    const service = new UpdaterService(logs as never, {
      autoUpdater: updater,
      isPackaged: true,
      currentVersion: '1.0.0'
    });

    await expect(service.checkForUpdates()).rejects.toThrow('network down');

    expect(service.getState()).toMatchObject({
      status: 'error',
      error: 'network down'
    });
    expect(logs.write).toHaveBeenCalled();
  });
});
