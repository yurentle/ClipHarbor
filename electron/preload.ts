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
  toggleDock: (show: boolean) => Promise<boolean>
  toggleTray: (show: boolean) => Promise<boolean>
  getDefaultShortcut: () => Promise<string>
  setShortcut: (shortcut: string) => Promise<boolean>
  closeHistoryWindow: () => Promise<void>
  toggleDockIcon: (show: boolean) => Promise<boolean>
  toggleTrayIcon: (show: boolean) => Promise<boolean>
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
  toggleDock: (show: boolean) => ipcRenderer.invoke('toggle-dock', show),
  toggleTray: (show: boolean) => ipcRenderer.invoke('toggle-tray', show),
  getDefaultShortcut: () => ipcRenderer.invoke('get-default-shortcut'),
  setShortcut: (shortcut: string) => ipcRenderer.invoke('set-shortcut', shortcut),
  closeHistoryWindow: () => ipcRenderer.invoke('close-history-window'),
  toggleDockIcon: (show: boolean) => ipcRenderer.invoke('toggle-dock-icon', show),
  toggleTrayIcon: (show: boolean) => ipcRenderer.invoke('toggle-tray-icon', show)
} as ElectronAPI)
