import { contextBridge, ipcRenderer } from 'electron'
import { ElectronAPI } from '../src/types/electron'
import { BrowserWindow } from 'electron'

// 为了 TypeScript 的类型检查
// declare global {
//   interface Window {
//     electronAPI: ElectronAPI
//   }
// }

// interface ElectronAPI {
//   onClipboardChange: (callback: (content: any) => void) => () => void
//   getClipboardHistory: () => Promise<any[]>
//   saveToClipboard: (item: any) => Promise<boolean>
//   removeFromHistory: (id: string) => Promise<boolean>
//   toggleFavorite: (id: string) => Promise<boolean>
//   closeHistoryWindow: () => Promise<void>
//   getStoreValue: (key: string) => Promise<any>
//   setStoreValue: (key: string, value: any) => Promise<boolean>
//   syncData: (config: string) => Promise<boolean>
//   syncDataFromCloud: (config: string) => Promise<boolean>
//   openStoreDirectory: () => Promise<void>
//   getHistoryFilePath: () => Promise<string>
//   openSettingsWindow: () => Promise<boolean>
//   closeSettingsWindow: () => Promise<boolean>
//   openExternal: (url: string) => Promise<void>
//   getAppVersion: () => Promise<string>
// }

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
  syncData: (config: string) => ipcRenderer.invoke('sync-data', config),
  syncDataFromCloud: (config: string) => ipcRenderer.invoke('sync-data-from-cloud', config),
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
  }
} as ElectronAPI)

// 通过 contextBridge 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer,
  store: {
    get: (key: string) => ipcRenderer.invoke('get-store-value', key),
    set: (key: string, value: any) => ipcRenderer.invoke('set-store-value', key, value),
    openDirectory: () => ipcRenderer.invoke('open-store-directory')
  }
})
