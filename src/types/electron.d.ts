import { ClipboardItem } from './clipboard'

export interface UpdateInfo {
  hasUpdate: boolean;
  version?: string;
  releaseNotes?: string;
  downloadUrl?: string;
}

export interface ElectronAPI {
  onClipboardChange: (callback: (newItem: ClipboardItem) => void) => () => void
  getClipboardHistory: () => Promise<ClipboardItem[]>
  saveToClipboard: (item: ClipboardItem) => Promise<void>
  removeFromHistory: (id: string) => Promise<boolean>
  toggleFavorite: (id: string) => Promise<boolean>
  closeHistoryWindow: () => Promise<void>
  getStoreValue: (key: string) => Promise<any>
  setStoreValue: (key: string, value: any) => Promise<boolean>
  syncData: (config: string, processId: string) => Promise<boolean>
  syncDataFromCloud: (config: string, processId: string) => Promise<boolean>
  openStoreDirectory: () => Promise<void>
  getHistoryFilePath: () => Promise<string>
  openSettingsWindow: () => Promise<boolean>
  closeSettingsWindow: () => Promise<boolean>
  openExternal: (url: string) => Promise<boolean>
  getAppVersion: () => Promise<string>
  isDevToolsOpened: () => boolean
  cancelSync: (processId: string) => Promise<boolean>
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>
    on: (channel: string, func: (...args: any[]) => void) => void
    removeListener: (channel: string, func: (...args: any[]) => void) => void
  }
  checkForUpdates: () => Promise<UpdateInfo>
}