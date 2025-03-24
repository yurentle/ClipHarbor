import { ipcMain } from 'electron';
import { clipboardManager } from '../core/clipboard';
import { store } from '../core/store';
import { logger } from '../utils/logger';
import { ClipboardItem } from '../../types/clipboard';
import { ClipboardHandlers } from './types';
import { IPC_CHANNELS } from '../utils/constants';

export function registerClipboardHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD.SAVE, async (_, item: ClipboardItem) => {
    try {
      return clipboardManager.writeToClipboard(item);
    } catch (error) {
      logger.error('Error saving to clipboard:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD.GET_HISTORY, async () => {
    try {
      return store.get('clipboardHistory', []);
    } catch (error) {
      logger.error('Error getting clipboard history:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD.REMOVE, async (_, id: string) => {
    try {
      const history = store.get('clipboardHistory', []) as ClipboardItem[];
      const newHistory = history.filter(item => item.id !== id);
      return store.set('clipboardHistory', newHistory);
    } catch (error) {
      logger.error('Error removing from history:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD.TOGGLE_FAVORITE, async (_, id: string) => {
    try {
      const history = store.get('clipboardHistory', []) as ClipboardItem[];
      const newHistory = history.map(item => 
        item.id === id ? { ...item, favorite: !item.favorite } : item
      );
      return store.set('clipboardHistory', newHistory);
    } catch (error) {
      logger.error('Error toggling favorite:', error);
      throw error;
    }
  });
} 