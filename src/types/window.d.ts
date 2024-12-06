import { ElectronAPI } from './electron'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
