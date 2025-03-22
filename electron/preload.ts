import { contextBridge, ipcRenderer } from 'electron'
import { ElectronAPI } from '../src/types/electron'
import { BrowserWindow } from 'electron'

type UpdateInfo = {
  hasUpdate: boolean;
  version?: string;
  releaseNotes?: string;
  downloadUrl?: string;
}

// 使用 contextBridge 暴露 API
contextBridge.exposeInMainWorld('electronAPI', {
  onClipboardChange: (callback: (content: any) => void) => {
    // 创建一个事件处理函数
    const eventHandler = (_: any, content: any) => callback(content);
    
    // 添加事件监听器
    ipcRenderer.on('clipboard-change', eventHandler);
    
    // 返回清理函数
    return () => {
      ipcRenderer.removeListener('clipboard-change', eventHandler);
    };
  },
  getClipboardHistory: () => ipcRenderer.invoke('get-clipboard-history'),
  saveToClipboard: (item: any) => ipcRenderer.invoke('save-to-clipboard', item),
  removeFromHistory: (id: string) => ipcRenderer.invoke('remove-from-history', id),
  toggleFavorite: (id: string) => ipcRenderer.invoke('toggle-favorite', id),
  closeHistoryWindow: () => ipcRenderer.invoke('close-history-window'),
  getStoreValue: (key: string) => ipcRenderer.invoke('get-store-value', key),
  setStoreValue: (key: string, value: any) => ipcRenderer.invoke('set-store-value', key, value),
  syncData: (config: string, processId: string) => ipcRenderer.invoke('sync-data', config, processId),
  syncDataFromCloud: (config: string, processId: string) => ipcRenderer.invoke('sync-data-from-cloud', config, processId),
  openStoreDirectory: () => ipcRenderer.invoke('open-store-directory'),
  getHistoryFilePath: () => ipcRenderer.invoke('get-history-file-path'),
  openSettingsWindow: () => {
    console.log('Preload: Calling openSettingsWindow');
    return ipcRenderer.invoke('open-settings-window');
  },
  closeSettingsWindow: () => ipcRenderer.invoke('close-settings-window'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  isDevToolsOpened: () => {
    const win = BrowserWindow.getFocusedWindow();
    return win?.webContents.isDevToolsOpened() ?? false;
  },
  cancelSync: (processId: string) => ipcRenderer.invoke('cancel-sync', processId),
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, func: (...args: any[]) => void) => {
      // 先移除可能存在的旧监听器
      ipcRenderer.removeAllListeners(channel);
      // 添加新监听器
      ipcRenderer.on(channel, func);
    },
    removeListener: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, func);
    },
  },
  checkForUpdates: (): Promise<UpdateInfo> => ipcRenderer.invoke('check-for-updates'),
} as ElectronAPI)
