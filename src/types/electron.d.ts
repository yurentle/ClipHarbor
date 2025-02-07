import { ClipboardItem } from './index'

export interface ElectronAPI {
  onClipboardChange: (callback: (newItem: ClipboardItem) => void) => () => void
  getClipboardHistory: () => Promise<ClipboardItem[]>
  saveToClipboard: (item: ClipboardItem) => Promise<boolean>
  removeFromHistory: (id: string) => Promise<boolean>
  toggleFavorite: (id: string) => Promise<boolean>
  toggleDock: (show: boolean) => Promise<boolean>
  toggleTray: (show: boolean) => Promise<boolean>
  getShortcut: () => Promise<string>
  setShortcut: (shortcut: string) => Promise<boolean>
  closeHistoryWindow: () => Promise<void>
  toggleDockIcon: (show: boolean) => Promise<boolean>
  toggleTrayIcon: (show: boolean) => Promise<boolean>
  getStoreValue: (key: string) => Promise<any>
  setStoreValue: (key: string, value: any) => Promise<boolean>
  syncData: (config: string) => Promise<boolean>
  syncDataFromCloud: (config: string) => Promise<boolean>
  openStoreDirectory: () => Promise<void>
  getHistoryFilePath: () => Promise<string>
  openSettingsWindow: () => Promise<void>
  openLocalFolder: () => Promise<void>
  setAutoHide: (value: boolean) => Promise<boolean>
  getAutoHide: () => Promise<boolean>
}