import { app, BrowserWindow, clipboard, ipcMain, nativeImage, globalShortcut, Tray, Menu, shell, MenuItemConstructorOptions } from 'electron';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { ClipboardItem, ClipboardHistory } from '../src/types/clipboard';
import { EventEmitter } from 'events';

declare global {
  var clipboardInterval: NodeJS.Timeout | undefined;
}

let settingWindow: BrowserWindow | null = null
let historyWindow: BrowserWindow | null = null
let contextMenu: Menu | null = null;
const isMac = process.platform === 'darwin';

// 在文件开头添加错误处理
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (error.message.includes('Cannot find module')) {
    console.error('Module not found error. Please check your dependencies.');
  }
});

// 在文件开头添加类型定义
interface StoreSchema {
  clipboardHistory: ClipboardItem[];
  settings: {
    shortcut: string;
    retentionPeriod: number;
    retentionUnit: string;
    rcloneConfig?: string;
  };
}

type StoreKey = string;

// 修改存储接口
interface IStore {
  get(key: StoreKey, defaultValue?: any): any;
  set(key: StoreKey, value: any): void;
  delete(key: StoreKey): void;
  clear(): void;
  path: string;
  onDidChange(key: StoreKey, callback: (newValue: any, oldValue: any) => void): () => void;
}

// 修改 BackupStore 类的实现
class BackupStore implements IStore {
  private data: StoreSchema;
  private emitter: EventEmitter;
  readonly path: string;
  private filePath: string;

  constructor(defaultData: StoreSchema, storePath: string) {
    this.data = defaultData;
    this.path = storePath;
    this.emitter = new EventEmitter();
    this.filePath = path.join(storePath, 'clipboard-history.json');

    // 尝试从文件加载数据
    this.loadFromFile();

    // 定期保存数据到文件
    setInterval(() => this.saveToFile(), 1000);
  }

  private loadFromFile() {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(fileContent);
        log('Data loaded from file:', this.filePath);
      } else {
        this.saveToFile(); // 如果文件不存在，创建文件并保存默认数据
        log('Created new data file:', this.filePath);
      }
    } catch (error) {
      console.error('Error loading data from file:', error);
    }
  }

  private saveToFile() {
    try {
      // 确保目录存在
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      // 保存数据到文件
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving data to file:', error);
    }
  }

  private getNestedValue(obj: any, path: string) {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  private setNestedValue(obj: any, path: string, value: any) {
    const parts = path.split('.');
    const last = parts.pop()!;
    const target = parts.reduce((acc, part) => acc[part] = acc[part] || {}, obj);
    target[last] = value;
  }

  get(key: StoreKey, defaultValue?: any): any {
    const value = this.getNestedValue(this.data, key);
    return value === undefined ? defaultValue : value;
  }

  set(key: StoreKey, value: any): void {
    this.setNestedValue(this.data, key, value);
    this.emitter.emit('change', key, value);
    this.saveToFile(); // 当数据变化时保存到文件
  }

  delete(key: StoreKey): void {
    this.setNestedValue(this.data, key, undefined);
    this.emitter.emit('change', key, undefined);
    this.saveToFile(); // 当数据变化时保存到文件
  }

  clear(): void {
    this.data = {
      clipboardHistory: [] as ClipboardItem[],
      settings: {
        shortcut: isMac ? 'Command+Shift+V' : 'Ctrl+Shift+V',
        retentionPeriod: 30,
        retentionUnit: 'days'
      }
    };
    this.emitter.emit('clear');
    this.saveToFile(); // 当数据变化时保存到文件
  }

  onDidChange(key: StoreKey, callback: (newValue: any, oldValue: any) => void): () => void {
    const handler = (changedKey: StoreKey, newValue: any) => {
      if (changedKey === key) {
        callback(newValue, this.get(key));
      }
    };
    this.emitter.on('change', handler);
    return () => this.emitter.off('change', handler);
  }
}

// 修改 store 的初始化
let store: IStore;

try {
  const data: StoreSchema = {
    clipboardHistory: [] as ClipboardItem[],
    settings: {
      shortcut: isMac ? 'Command+Shift+V' : 'Ctrl+Shift+V',
      retentionPeriod: 30,
      retentionUnit: 'days'
    }
  };

  store = new BackupStore(data, app.getPath('userData'));
} catch (error) {
  console.error('Failed to initialize store:', error);
  
  const defaultSettings: StoreSchema['settings'] = {
    shortcut: isMac ? 'Command+Shift+V' : 'Ctrl+Shift+V',
    retentionPeriod: 30,
    retentionUnit: 'days'
  };

  const backupStore: StoreSchema = {
    clipboardHistory: [] as ClipboardItem[],
    settings: defaultSettings
  };

  store = new BackupStore(backupStore, app.getPath('userData'));
}

// 打印存储路径
log('Store path:', store.path);

const historyFileName = 'clipboard-history.json';

// 创建日志函数
function log(...args: any[]) {
  const time = new Date().toISOString();
  console.log(`[${time}]`, ...args);
}

// Debug: 打印初始配置
log('Initial store settings:', JSON.stringify(store.get('settings'), null, 2));

// 监听设置变化
store.onDidChange('settings', (newValue, oldValue) => {
  log('Settings changed:', 
    '\nOld:', JSON.stringify(oldValue, null, 2),
    '\nNew:', JSON.stringify(newValue, null, 2)
  );
});

const __dirname = path.dirname(__filename)

function getImageMetadata(dataUrl: string): { width: number; height: number; size: number } {
  const img = nativeImage.createFromDataURL(dataUrl)
  const size = Buffer.from(dataUrl.split(',')[1], 'base64').length
  const { width, height } = img.getSize()
  
  return {
    width,
    height,
    size
  }
}

// 修改 ShortcutManager 类
class ShortcutManager {
  private currentShortcut: string | null = null;

  constructor(private readonly _defaultShortcut: string) {}

  get defaultShortcut(): string {
    return this._defaultShortcut;
  }

  private async shortcutHandler() {
    log('Shortcut triggered');
    if (historyWindow?.isVisible()) {
      historyWindow.hide();
    } else {
      await createHistoryWindow();
    }
  }

  register(shortcut: string): boolean {
    try {
      log('Registering shortcut:', shortcut);
      
      // 先注销当前快捷键
      this.unregister();

      // // 检查快捷键是否已被其他应用注册
      // if (globalShortcut.isRegistered(shortcut)) {
      //   log('Warning: Shortcut is already registered by another application:', shortcut);
      //   return false;
      // }

      // 创建快捷键处理函数的绑定版本
      const boundHandler = this.shortcutHandler.bind(this);
      const success = globalShortcut.register(shortcut, boundHandler);
      
      if (success) {
        this.currentShortcut = shortcut;
        log('Shortcut registered successfully:', shortcut);
        return true;
      }
      
      log('Failed to register shortcut:', shortcut);
      return false;
    } catch (error) {
      console.error('Error registering shortcut:', error);
      return false;
    }
  }

  unregister() {
    if (this.currentShortcut) {
      globalShortcut.unregister(this.currentShortcut);
      log('Shortcut unregistered:', this.currentShortcut);
      this.currentShortcut = null;
    }
  }

  unregisterAll() {
    globalShortcut.unregisterAll();
    this.currentShortcut = null;
    log('All shortcuts unregistered');
  }
}

// 使用快捷键管理类
const shortcutManager = new ShortcutManager(
  isMac ? 'Command+Shift+V' : 'Ctrl+Shift+V'
);

// 创建一个函数来处理所有与 Store 相关的 IPC 通信
function registerStoreHandlers() {
  // 获取存储值
  ipcMain.handle('store-get', (_, key: string) => {
    return store.get(key);
  });

  // 设置存储值
  ipcMain.handle('store-set', (_, key: string, value: any) => {
    store.set(key, value);
    return true;
  });

  // 删除存储值
  ipcMain.handle('store-delete', (_, key: 'clipboardHistory' | 'settings') => {
    store.delete(key);
    return true;
  });

  // 清空存储
  ipcMain.handle('store-clear', () => {
    store.clear();
    return true;
  });

  // 获取存储路径
  ipcMain.handle('store-path', () => {
    return store.path;
  });
}

// 注册所有的 IPC 处理程序
function registerIpcHandlers() {
  // 获取剪贴板历史
  ipcMain.handle('get-clipboard-history', () => {
    return store.get('clipboardHistory', [])
  })

  // 处理保存到剪贴板
  ipcMain.handle('save-to-clipboard', (_, item: ClipboardItem) => {
    try {
      if (item.type === 'image') {
        const image = nativeImage.createFromDataURL(item.content);
        clipboard.writeImage(image);
      } else {
        clipboard.writeText(item.content);
      }
      return true;
    } catch (error) {
      console.error('Error saving to clipboard:', error);
      return false;
    }
  })

  // 从历史记录中删除
  ipcMain.handle('remove-from-history', (_, id: string) => {
    const history = store.get('clipboardHistory', []) as ClipboardItem[]
    const newHistory = history.filter(item => item.id !== id)
    store.set('clipboardHistory', newHistory)
    return true
  })

  // 切换收藏状态
  ipcMain.handle('toggle-favorite', (_, id: string) => {
    const history = store.get('clipboardHistory', []) as ClipboardItem[]
    const newHistory = history.map(item => 
      item.id === id ? { ...item, favorite: !item.favorite } : item
    )
    store.set('clipboardHistory', newHistory)
    return true
  })
  
  // 关闭历史窗口
  ipcMain.handle('close-history-window', () => {
    if (historyWindow) {
      historyWindow.hide()
    }
  })
  
  // 通用的获取存储值的处理程序
  ipcMain.handle('get-store-value', (_, key: string) => {
    try {
      const value = store.get(`settings.${key}`);
      log(`Getting store value for ${key}:`, value);
      return value;
    } catch (error) {
      log(`Error getting store value for ${key}:`, error);
      return undefined;
    }
  });

  // 通用的设置存储值的处理程序
  ipcMain.handle('set-store-value', (_, key: string, value: any) => {
    try {
      store.set(`settings.${key}`, value);
      log(`Setting store value for ${key}:`, value);
      return true;
    } catch (error) {
      log(`Error setting store value for ${key}:`, error);
      return false;
    }
  });

  // 获取历史记录文件路径
  ipcMain.handle('get-history-file-path', () => {
    const localPath = app.getPath('userData');
    const localFile = path.join(localPath, historyFileName);
    return localFile;
  });

  // 同步数据到云端
  ipcMain.handle('sync-data', async (event, rcloneConfig: string) => {
    if (!rcloneConfig) {
      throw new Error('请提供 Rclone 配置');
    }

    // 保存配置
    await store.set('settings.rcloneConfig', rcloneConfig);
    log('Saved Rclone config:', rcloneConfig);
    const execFileAsync = promisify(execFile);
    const localPath = app.getPath('userData');
    const localFile = path.join(localPath, historyFileName);

    try {
      // 确保本地数据文件存在
      if (!fs.existsSync(localFile)) {
        // 如果文件不存在，创建一个包含空历史记录的文件
        const initialData: ClipboardHistory = {
          clipboardHistory: store.get('clipboardHistory', []) as ClipboardItem[]
        };
        await fs.promises.mkdir(path.dirname(localFile), { recursive: true });
        await fs.promises.writeFile(localFile, JSON.stringify(initialData, null, 2));
      }

      // 验证文件是否可读
      try {
        await fs.promises.access(localFile, fs.constants.R_OK);
      } catch (error) {
        throw new Error('无法读取本地数据文件，请检查文件权限');
      }

      // 使用 rclone 复制文件到云端
      await execFileAsync('rclone', ['copy', localFile, rcloneConfig]);
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT' && error.path === 'rclone') {
        throw new Error('未安装 rclone，请先安装 rclone 并配置远程存储');
      }
      
      // 提供更详细的错误信息
      const errorMessage = error.message || '未知错误';
      if (errorMessage.includes('directory not found')) {
        throw new Error('本地数据文件不存在或无法访问，请确保应用有权限访问该目录');
      }
      throw new Error(`同步失败: ${errorMessage}`);
    }
  });

  // 从云端同步数据到本地
  ipcMain.handle('sync-data-from-cloud', async (event, rcloneConfig: string) => {
    if (!rcloneConfig) {
      throw new Error('请提供 Rclone 配置');
    }

    const execFileAsync = promisify(execFile);
    const localPath = app.getPath('userData');
    const localFile = path.join(localPath, historyFileName);

    try {
      // 确保本地目录存在
      await fs.promises.mkdir(path.dirname(localFile), { recursive: true });

      // 使用 rclone 从云端复制文件到本地
      await execFileAsync('rclone', ['copy', rcloneConfig, localPath]);
      
      try {
        // 读取并验证同步的数据
        const data = await fs.promises.readFile(localFile, 'utf-8');
        const parsedData = JSON.parse(data);
        
        if (Array.isArray(parsedData.clipboardHistory)) {
          store.set('clipboardHistory', parsedData.clipboardHistory);
        } else {
          throw new Error('同步的数据格式无效');
        }
      } catch (parseError) {
        throw new Error('无法解析同步的数据，可能是文件格式错误');
      }
      
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT' && error.path === 'rclone') {
        throw new Error('未安装 rclone，请先安装 rclone 并配置远程存储');
      }
      throw new Error(`同步失败: ${error.message}`);
    }
  });

  // 打开存储目录
  ipcMain.handle('open-store-directory', () => {
    const localPath = app.getPath('userData');
    shell.openPath(localPath);
  });

  // 添加打开设置窗口的处理程序
  ipcMain.handle('open-settings-window', async () => {
    log('======open settings window=======');
    try {
      await createSettingWindow();
      return true;
    } catch (error) {
      console.error('Error opening settings window:', error);
      return false;
    }
  });

  // 添加关闭设置窗口的处理程序
  ipcMain.handle('close-settings-window', () => {
    if (settingWindow) {
      settingWindow.hide();
    }
    return true;
  });

  // 注册 Store 相关的处理程序
  registerStoreHandlers();
}

// 广播剪贴板变化到所有窗口
function broadcastClipboardChange(item: ClipboardItem) {
  if (settingWindow) {
    settingWindow.webContents.send('clipboard-change', item);
  }
  if (historyWindow) {
    historyWindow.webContents.send('clipboard-change', item);
  }
}

// 添加窗口尺寸常量
const WINDOW_SIZES = {
  settings: {
    width: 600,
    height: 400
  },
  history: {
    width: 500,
    height: 600
  }
} as const;

// 创建一个通用的窗口创建函数
async function createAppWindow(options: {
  width: number;
  height: number;
  isHistory?: boolean;
  hash?: string;
}) {
  const { width, height, isHistory = false, hash = '' } = options;
  log(`Creating ${isHistory ? 'history' : 'settings'} window...`);
  
  // 选择要操作的窗口引用
  let windowRef = isHistory ? historyWindow : settingWindow;
  
  // 如果窗口已存在且没有被销毁
  if (windowRef && !windowRef.isDestroyed()) {
    windowRef.show();
    windowRef.focus();
    
    // 如果有指定的 hash，更新窗口的 URL
    if (hash) {
      const isDev = process.env.NODE_ENV === 'development';
      const url = isDev ? 
        `http://localhost:5173/#${hash}` : 
        `file://${path.join(__dirname, '../dist/index.html')}#${hash}`;
      
      await windowRef.loadURL(url);
    }
    
    return;
  }

  // 创建新窗口
  const win = new BrowserWindow({
    width,
    height,
    icon: path.join(__dirname, '../public/icons/logo_dock.png'),
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
      sandbox: false,
    },
    ...(isHistory ? {
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      vibrancy: 'menu',
      visualEffectState: 'active',
      roundedCorners: true,
    } : {})
  });

  // 设置窗口引用
  if (isHistory) {
    historyWindow = win;
  } else {
    settingWindow = win;
  }

  try {
    const isDev = process.env.NODE_ENV === 'development';
    const url = isDev 
      ? `http://localhost:5173${hash ? `/#${hash}` : ''}`
      : `file://${path.join(__dirname, '../dist/index.html')}${hash ? `#${hash}` : ''}`;

    log('Loading URL:', url);
    await win.loadURL(url);

    // 设置窗口事件监听
    if (isHistory) {
      setupHistoryWindowEvents(win);
    } else {
      setupSettingWindowEvents(win);
    }

    // 等待内容加载完成后再显示窗口
    win.once('ready-to-show', () => {
      log('Window ready to show');
      win.show();
      win.focus();
      if (isHistory) {
        setTimeout(() => win.setAlwaysOnTop(false), 300);
      }
    });

  } catch (error) {
    console.error(`Error loading ${isHistory ? 'history' : 'settings'} window:`, error);
    throw error;
  }
}

// 设置历史窗口的事件监听
function setupHistoryWindowEvents(win: BrowserWindow) {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && !input.alt && !input.control && !input.shift && !input.meta) {
      win.hide();
    }
  });

  win.on('hide', () => {
    // 确保窗口完全隐藏后再注册快捷键
    setImmediate(() => {
      const settings = store.get('settings') as StoreSchema['settings'];
      const shortcut = settings?.shortcut || shortcutManager.defaultShortcut;
      shortcutManager.register(shortcut);
    });
  });

  win.on('blur', () => {
    if (!win.webContents.isDevToolsOpened()) {
      win.hide();
    }
  });

  win.on('closed', () => {
    historyWindow = null;
    // 确保窗口完全关闭后再注册快捷键
    setImmediate(() => {
      const settings = store.get('settings') as StoreSchema['settings'];
      const shortcut = settings?.shortcut || shortcutManager.defaultShortcut;
      shortcutManager.register(shortcut);
    });
  });
}

// 设置主窗口的事件监听
function setupSettingWindowEvents(win: BrowserWindow) {
  win.on('closed', () => {
    settingWindow = null;
  });

  win.on('close', (event) => {
    event.preventDefault();
    win.hide();
  });
}

// 修改原有的创建窗口函数
async function createSettingWindow() {
  await createAppWindow({
    ...WINDOW_SIZES.settings,
    hash: '/settings'
  });
}

async function createHistoryWindow() {
  await createAppWindow({
    ...WINDOW_SIZES.history,
    isHistory: true
  });
}

// 创建托盘图标
function createTrayIcon(): Tray {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../public/icons/logo_tray_Template@2x.png'));
  const newTray = new Tray(icon);
  newTray.setToolTip('ClipHarbor');
  contextMenu = contextMenu || createContextMenu();
  newTray.setContextMenu(contextMenu);
  return newTray;
}

// 创建托盘菜单
function createContextMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '打开设置',
      click: async () => {
        await createSettingWindow();
      }
    },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ];
  return Menu.buildFromTemplate(template);
}

// 开始监听剪贴板变化
function startClipboardMonitoring() {
  console.log('Starting clipboard monitoring...');
  let lastContent = '';
  let lastImage = '';

  // 每秒检查一次剪贴板变化
  global.clipboardInterval = setInterval(() => {
    try {
      // 检查是否有文件
      const filePaths = clipboard.readBuffer('FileNameW');
      if (filePaths.length > 0) {
        try {
          const files = clipboard.readBuffer('FileNameW').toString('ucs2').replace(/\\/g, '/').split('\0').filter(Boolean);
          if (files.length > 0 && files.join(',') !== lastContent) {
            lastContent = files.join(',');
            const history = store.get('clipboardHistory', []) as ClipboardItem[];
            const newItem: ClipboardItem = {
              id: uuidv4(),
              content: files.join(','),
              type: 'text',
              timestamp: Date.now(),
              favorite: false
            }
            const newHistory = [newItem, ...history.filter(item => item.content !== newItem.content)];
            store.set('clipboardHistory', newHistory);
            broadcastClipboardChange(newItem);
          }
        } catch (error) {
          console.error('Error processing file paths:', error);
        }
        return;
      }

      // 检查是否有图片
      const image = clipboard.readImage();
      if (!image.isEmpty()) {
        const dataUrl = image.toDataURL();
        if (dataUrl !== lastImage) {
          lastImage = dataUrl;
          const metadata = getImageMetadata(dataUrl);
          const history = store.get('clipboardHistory', []) as ClipboardItem[];
          const newItem: ClipboardItem = {
            id: uuidv4(),
            content: dataUrl,
            type: 'image',
            timestamp: Date.now(),
            favorite: false,
            metadata
          }
          const newHistory = [newItem, ...history.filter(i => i.content !== dataUrl)];
          store.set('clipboardHistory', newHistory);
          broadcastClipboardChange(newItem);
        }
      } else {
        // 检查文本内容
        const text = clipboard.readText();
        if (text && text !== lastContent) {
          lastContent = text;
          const history = store.get('clipboardHistory', []) as ClipboardItem[];
          const newItem: ClipboardItem = {
            id: uuidv4(),
            content: text,
            type: 'text',
            timestamp: Date.now(),
            favorite: false
          }
          const newHistory = [newItem, ...history.filter(i => i.content !== newItem.content)];
          store.set('clipboardHistory', newHistory);
          broadcastClipboardChange(newItem);
        }
      }
    } catch (error) {
      console.error('Error reading clipboard:', error);
    }
  }, 1000);

  console.log('Clipboard monitoring started');
}

app.whenReady().then(async () => {
  try {
    console.log('App is ready, initializing...');
    
    // 立即创建并显示设置窗口
    log('Creating settings window...');
    await createSettingWindow();

    if (isMac) {
      app.dock.setIcon(path.join(__dirname, '../public/icons/logo_dock.png'));
    }

    // 创建托盘图标
    createTrayIcon();

    // 注册 IPC 处理程序
    registerIpcHandlers();

    // 开始监听剪贴板
    startClipboardMonitoring();

    // 确保设置窗口创建完成后再注册快捷键
    log('Registering shortcuts...');
    const settings = store.get('settings') as StoreSchema['settings'];
    const shortcut = settings?.shortcut || shortcutManager.defaultShortcut;
    const registered = shortcutManager.register(shortcut);
    
    if (!registered) {
      log('Failed to register initial shortcut, trying default shortcut');
      shortcutManager.register(shortcutManager.defaultShortcut);
    }

    app.on('activate', async () => {
      if (!settingWindow) {
        await createSettingWindow();
      } else {
        settingWindow.show();
      }
    });

    // 在应用退出前注销所有快捷键
    app.on('will-quit', () => {
      globalShortcut.unregisterAll();
    });

    // 当应用退出前，清理资源
    app.on('before-quit', () => {
      // 停止剪贴板监控
      if (global.clipboardInterval) {
        clearInterval(global.clipboardInterval);
      }
      
      // 关闭所有窗口
      BrowserWindow.getAllWindows().forEach(window => {
        window.destroy();
      });
      
      // 清理窗口引用
      settingWindow = null;
      historyWindow = null;
    });

  } catch (error) {
    console.error('Error during app initialization:', error);
  }
});

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit();
  }
});

ipcMain.handle('open-external', async (_, url) => {
  await shell.openExternal(url);
});
