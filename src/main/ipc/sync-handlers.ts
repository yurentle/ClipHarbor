import { ipcMain } from 'electron';
import { store } from '../core/store';
import { logger } from '../utils/logger';
import { syncManager } from '../core/sync';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { SyncHandlers } from './types';
import { IPC_CHANNELS } from '../utils/constants';

// 添加类型定义
interface SyncProcessError extends Error {
  code?: string;
  path?: string;
}

export function registerSyncHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SYNC.TO_CLOUD, async (event, config: string, processId: string) => {
    try {
      await syncManager.syncToCloud(event, config, processId);
      return true;
    } catch (error) {
      logger.error('Error syncing to cloud:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYNC.FROM_CLOUD, async (event, config: string, processId: string) => {
    try {
      await syncManager.syncFromCloud(event, config, processId);
      return true;
    } catch (error) {
      logger.error('Error syncing from cloud:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYNC.CANCEL, async (_, processId: string) => {
    try {
      const result = syncManager.cancelSync(processId);
      if (result) {
        logger.info('Sync cancelled:', processId);
      } else {
        logger.warn('No sync process found to cancel:', processId);
      }
      return result;
    } catch (error) {
      logger.error('Error cancelling sync:', error);
      throw error;
    }
  });
} 