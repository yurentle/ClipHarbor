import { contextBridge, ipcRenderer } from 'electron'
import { ElectronAPI } from '../types/electron'
import { ClipboardItem } from '../types/clipboard'

type UpdateInfo = {
  hasUpdate: boolean;
  version?: string;
  releaseNotes?: string;
  downloadUrl?: string;
}

// Store API
const storeAPI = {
  get: (key: string) => ipcRenderer.invoke('store-get', key),
  set: (key: string, value: any) => ipcRenderer.invoke('store-set', key, value),
  delete: (key: string) => ipcRenderer.invoke('store-delete', key),
  clear: () => ipcRenderer.invoke('store-clear'),
  onDidChange: (callback: (newValue: any, oldValue: any) => void) => {
    const eventHandler = (_: any, newValue: any, oldValue: any) => callback(newValue, oldValue);
    ipcRenderer.on('store-change', eventHandler);
    return () => {
      ipcRenderer.removeListener('store-change', eventHandler);
    };
  },
}

// Clipboard API
const clipboardAPI = {
  saveToClipboard: (item: ClipboardItem) => ipcRenderer.invoke('save-to-clipboard', item),
  getHistory: () => ipcRenderer.invoke('get-clipboard-history'),
  removeFromHistory: (id: string) => ipcRenderer.invoke('remove-from-history', id),
  toggleFavorite: (id: string) => ipcRenderer.invoke('toggle-favorite', id),
  onClipboardChange: (callback: (item: ClipboardItem) => void) => {
    const eventHandler = (_: any, item: ClipboardItem) => callback(item);
    ipcRenderer.on('clipboard-change', eventHandler);
    return () => {
      ipcRenderer.removeListener('clipboard-change', eventHandler);
    };
  },
}

// Window API
const windowAPI = {
  closeHistoryWindow: () => ipcRenderer.invoke('close-history-window'),
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
  closeSettingsWindow: () => ipcRenderer.invoke('close-settings-window'),
  isDevToolsOpened: () => ipcRenderer.invoke('is-devtools-opened'),
}

// System API
const systemAPI = {
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: (): Promise<UpdateInfo> => ipcRenderer.invoke('check-for-updates'),
  openStoreDirectory: () => ipcRenderer.invoke('open-store-directory'),
  getHistoryFilePath: () => ipcRenderer.invoke('get-history-file-path'),
  registerShortcut: (shortcut: string) => ipcRenderer.invoke('register-shortcut', shortcut),
}

// Sync API
const syncAPI = {
  syncData: (config: string, processId: string) => ipcRenderer.invoke('sync-data', config, processId),
  syncDataFromCloud: (config: string, processId: string) => ipcRenderer.invoke('sync-data-from-cloud', config, processId),
  cancelSync: (processId: string) => ipcRenderer.invoke('cancel-sync', processId),
  onSyncProgress: (callback: (data: { processId: string; data: string }) => void) => {
    const eventHandler = (_: any, data: any) => callback(data);
    ipcRenderer.on('sync-progress', eventHandler);
    return () => {
      ipcRenderer.removeListener('sync-progress', eventHandler);
    };
  },
}

// IPC API
const ipcAPI = {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, func: (...args: any[]) => void) => {
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, func);
  },
  removeListener: (channel: string, func: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, func);
  },
}

// 使用 contextBridge 暴露 API
contextBridge.exposeInMainWorld('electronAPI', {
  store: storeAPI,
  clipboard: clipboardAPI,
  window: windowAPI,
  system: systemAPI,
  sync: syncAPI,
  ipcRenderer: ipcAPI,
} as ElectronAPI)
