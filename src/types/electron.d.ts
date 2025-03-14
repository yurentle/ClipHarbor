import { ClipboardItem } from './clipboard'

export interface ElectronAPI {
  onClipboardChange: (callback: (newItem: ClipboardItem) => void) => () => void
  getClipboardHistory: () => Promise<ClipboardItem[]>
  saveToClipboard: (item: ClipboardItem) => Promise<void>
  removeFromHistory: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  toggleDock: (show: boolean) => Promise<void>
  toggleTray: (show: boolean) => Promise<void>
  getShortcut: () => Promise<string>
  setShortcut: (shortcut: string) => Promise<void>
  closeHistoryWindow: () => Promise<void>
  toggleDockIcon: (show: boolean) => Promise<boolean>
  toggleTrayIcon: (show: boolean) => Promise<boolean>
  getStoreValue: (key: string) => Promise<any>
  setStoreValue: (key: string, value: any) => Promise<boolean>
  syncData: (config: string) => Promise<boolean>
  syncDataFromCloud: (config: string) => Promise<boolean>
  openStoreDirectory: () => Promise<void>
  getHistoryFilePath: () => Promise<string>
  openSettingsWindow: () => Promise<boolean>
}