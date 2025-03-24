import { ipcMain, shell, app } from 'electron';
import { store } from '../core/store';
import { shortcutManager } from '../core/shortcut';
import { logger } from '../utils/logger';
import { Octokit } from '@octokit/rest';
import { IPC_CHANNELS } from '../utils/constants';

export function registerSystemHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SYSTEM.OPEN_EXTERNAL, async (_, url: string) => {
    try {
      await shell.openExternal(url);
    } catch (error) {
      logger.error('Error opening external URL:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM.GET_APP_VERSION, () => {
    return app.getVersion();
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM.CHECK_UPDATES, async () => {
    try {
      logger.info('Checking for updates...');
      const octokit = new Octokit();
      const { data: latestRelease } = await octokit.repos.getLatestRelease({
        owner: 'yurentle',
        repo: 'ClipHarbor'
      });

      const currentVersion = app.getVersion();
      const latestVersion = latestRelease.tag_name.replace('v', '');

      return {
        hasUpdate: latestVersion > currentVersion,
        version: latestVersion,
        releaseNotes: latestRelease.body,
        downloadUrl: latestRelease.html_url
      };
    } catch (error) {
      logger.error('Error checking for updates:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM.OPEN_STORE_DIRECTORY, async () => {
    try {
      await shell.openPath(store.path);
    } catch (error) {
      logger.error('Error opening store directory:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM.GET_HISTORY_FILE_PATH, () => {
    return store.filePath;
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM.REGISTER_SHORTCUT, async (_, shortcut: string) => {
    try {
      return shortcutManager.register(shortcut);
    } catch (error) {
      logger.error('Error registering shortcut:', error);
      throw error;
    }
  });
} 