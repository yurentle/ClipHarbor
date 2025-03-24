import { ipcMain } from 'electron';
import { store } from '../core/store';
import { logger } from '../utils/logger';
import { StoreHandlers } from './types';
import { IPC_CHANNELS } from '../utils/constants';

export function registerStoreHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.STORE.GET, async (_, key: string) => {
    try {
      return store.get(key);
    } catch (error) {
      logger.error('Error getting store value:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.STORE.SET, async (_, key: string, value: any) => {
    try {
      return store.set(key, value);
    } catch (error) {
      logger.error('Error setting store value:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.STORE.DELETE, async (_, key: string) => {
    try {
      store.delete(key);
    } catch (error) {
      logger.error('Error deleting store value:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.STORE.CLEAR, async () => {
    try {
      store.clear();
    } catch (error) {
      logger.error('Error clearing store:', error);
      throw error;
    }
  });
} 