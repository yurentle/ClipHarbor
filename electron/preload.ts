const { contextBridge, ipcRenderer } = require('electron')

// 定义 API 类型
interface ElectronAPI {
  onClipboardChange: (callback: (content: string) => void) => () => void
  getClipboardHistory: () => Promise<string[]>
  saveToClipboard: (text: string) => Promise<boolean>
  removeFromHistory: (text: string) => Promise<boolean>
}

// 声明全局类型
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  onClipboardChange: (callback: (content: string) => void) => {
    const subscription = (_event: any, content: string) => callback(content)
    ipcRenderer.on('clipboard-change', subscription)
    return () => {
      ipcRenderer.removeListener('clipboard-change', subscription)
    }
  },
  getClipboardHistory: () => ipcRenderer.invoke('get-clipboard-history'),
  saveToClipboard: (text: string) => ipcRenderer.invoke('save-to-clipboard', text),
  removeFromHistory: (text: string) => ipcRenderer.invoke('remove-from-history', text)
} as ElectronAPI)
