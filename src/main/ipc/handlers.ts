import { registerStoreHandlers } from './store-handlers';
import { registerClipboardHandlers } from './clipboard-handlers';
import { registerWindowHandlers } from './window-handlers';
import { registerSystemHandlers } from './system-handlers';
import { registerSyncHandlers } from './sync-handlers';
import { logger } from '../utils/logger';
import { ipcMain, BrowserWindow } from 'electron'

export function registerIpcHandlers(): void {
  try {
    registerStoreHandlers();
    registerClipboardHandlers();
    registerWindowHandlers();
    registerSystemHandlers();
    registerSyncHandlers();
    logger.info('IPC handlers registered successfully');

    // 添加新的 IPC 处理程序
    ipcMain.handle('is-devtools-opened', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      return win?.webContents.isDevToolsOpened() ?? false
    })
  } catch (error) {
    logger.error('Error registering IPC handlers:', error);
    throw error;
  }
}
