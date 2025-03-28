import { ipcMain } from 'electron';
import { HistoryWindow } from '../windows/historyWindow';
import { SettingsWindow } from '../windows/settingsWindow';
import { logger } from '../utils/logger';
import { IPC_CHANNELS } from '../utils/constants';

export function registerWindowHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.WINDOW.CLOSE_HISTORY, async () => {
    try {
      HistoryWindow.getInstance().hide();
      return true;
    } catch (error) {
      logger.error('Error closing history window:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW.OPEN_SETTINGS, async () => {
    try {
      await SettingsWindow.getInstance().create();
    } catch (error) {
      logger.error('Error opening settings window:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW.CLOSE_SETTINGS, async () => {
    try {
      SettingsWindow.getInstance().hide();
    } catch (error) {
      logger.error('Error closing settings window:', error);
      throw error;
    }
  });
} 