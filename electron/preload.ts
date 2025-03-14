import { contextBridge, ipcRenderer } from 'electron'

// 为了 TypeScript 的类型检查
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

interface ElectronAPI {
  onClipboardChange: (callback: (content: any) => void) => () => void
  getClipboardHistory: () => Promise<any[]>
  saveToClipboard: (item: any) => Promise<boolean>
  removeFromHistory: (id: string) => Promise<boolean>
  toggleFavorite: (id: string) => Promise<boolean>
  getShortcut: () => Promise<string>
  setShortcut: (shortcut: string) => Promise<boolean>
  closeHistoryWindow: () => Promise<void>
  getStoreValue: (key: string) => Promise<any>
  setStoreValue: (key: string, value: any) => Promise<boolean>
  syncData: (config: string) => Promise<boolean>
  syncDataFromCloud: (config: string) => Promise<boolean>
  openStoreDirectory: () => Promise<void>
  getHistoryFilePath: () => Promise<string>
  openSettingsWindow: () => Promise<boolean>
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
  getShortcut: () => ipcRenderer.invoke('get-shortcut'),
  setShortcut: (shortcut: string) => ipcRenderer.invoke('set-shortcut', shortcut),
  closeHistoryWindow: () => ipcRenderer.invoke('close-history-window'),
  getStoreValue: (key: string) => ipcRenderer.invoke('get-store-value', key),
  setStoreValue: (key: string, value: any) => ipcRenderer.invoke('set-store-value', key, value),
  syncData: (config: string) => ipcRenderer.invoke('sync-data', config),
  syncDataFromCloud: (config: string) => ipcRenderer.invoke('sync-data-from-cloud', config),
  openStoreDirectory: () => ipcRenderer.invoke('open-store-directory'),
  getHistoryFilePath: () => ipcRenderer.invoke('get-history-file-path'),
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window')
} as ElectronAPI)

contextBridge.exposeInMainWorld('electronStore', {
  get: (key: string) => ipcRenderer.invoke('store-get', key),
  set: (key: string, value: any) => ipcRenderer.invoke('store-set', key, value),
  delete: (key: string) => ipcRenderer.invoke('store-delete', key),
  clear: () => ipcRenderer.invoke('store-clear'),
  path: () => ipcRenderer.invoke('store-path')
})
