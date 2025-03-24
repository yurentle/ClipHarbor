import { app } from 'electron';
import path from 'path';

export const IS_MAC = process.platform === 'darwin';
export const IS_DEV = process.env.NODE_ENV === 'development';

export const PATHS = {
  userData: app.getPath('userData'),
  logs: path.join(app.getPath('userData'), IS_DEV ? 'logs-dev' : 'logs'),
  resources: IS_DEV 
    ? path.join(process.cwd(), 'resources')
    : path.join(process.resourcesPath),
  icons: IS_DEV
    ? path.join(process.cwd(), 'resources/icons')
    : path.join(process.resourcesPath, 'icons')
} as const;

export const WINDOW_SIZES = {
  settings: {
    width: 600,
    height: 400,
    minWidth: 500,
    minHeight: 300,
  },
  history: {
    width: 500,
    height: 600,
    minWidth: 400,
    minHeight: 400,
  },
} as const;

export const DEFAULT_SETTINGS = {
  shortcut: IS_MAC ? 'Command+Shift+V' : 'Ctrl+Shift+V',
  retentionPeriod: 30,
  retentionUnit: 'days',
} as const;

export const IPC_CHANNELS = {
  STORE: {
    GET: 'store-get',
    SET: 'store-set',
    DELETE: 'store-delete',
    CLEAR: 'store-clear',
  },
  CLIPBOARD: {
    SAVE: 'save-to-clipboard',
    GET_HISTORY: 'get-clipboard-history',
    REMOVE: 'remove-from-history',
    TOGGLE_FAVORITE: 'toggle-favorite',
    CHANGE: 'clipboard-change',
  },
  WINDOW: {
    CLOSE_HISTORY: 'close-history-window',
    OPEN_SETTINGS: 'open-settings-window',
    CLOSE_SETTINGS: 'close-settings-window',
  },
  SYSTEM: {
    OPEN_EXTERNAL: 'open-external',
    GET_APP_VERSION: 'get-app-version',
    CHECK_UPDATES: 'check-for-updates',
    OPEN_STORE_DIRECTORY: 'open-store-directory',
    GET_HISTORY_FILE_PATH: 'get-history-file-path',
    REGISTER_SHORTCUT: 'register-shortcut',
  },
  SYNC: {
    TO_CLOUD: 'sync-data',
    FROM_CLOUD: 'sync-data-from-cloud',
    CANCEL: 'cancel-sync',
    PROGRESS: 'sync-progress',
  },
} as const; 