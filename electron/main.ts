import { app, BrowserWindow, clipboard, ipcMain, nativeImage, globalShortcut, Tray, Menu, shell, screen, MenuItemConstructorOptions } from 'electron';
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

let mainWindow: BrowserWindow | null = null
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

  constructor(defaultData: StoreSchema, storePath: string) {
    this.data = defaultData;
    this.path = storePath;
    this.emitter = new EventEmitter();
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
  }

  delete(key: StoreKey): void {
    this.setNestedValue(this.data, key, undefined);
    this.emitter.emit('change', key, undefined);
  }

  clear(): void {
    this.data = {
      clipboardHistory: [] as ClipboardItem[],
      settings: {
        shortcut: isMac ? 'CommandOrControl+Shift+V' : 'Ctrl+Shift+V',
        retentionPeriod: 30,
        retentionUnit: 'days'
      }
    };
    this.emitter.emit('clear');
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
      shortcut: isMac ? 'CommandOrControl+Shift+V' : 'Ctrl+Shift+V',
      retentionPeriod: 30,
      retentionUnit: 'days'
    }
  };

  store = new BackupStore(data, app.getPath('userData'));
} catch (error) {
  console.error('Failed to initialize store:', error);
  
  const defaultSettings: StoreSchema['settings'] = {
    shortcut: isMac ? 'CommandOrControl+Shift+V' : 'Ctrl+Shift+V',
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

// 创建 IPC 日志函数
function ipcLog(...args: any[]) {
  const time = new Date().toISOString();
  console.log(`[${time}]`, ...args);
  if (mainWindow) {
    mainWindow.webContents.send('log', `[${time}] ${args.join(' ')}`);
  }
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

// 注册快捷键处理函数
function registerShortcutHandler() {
  return () => {
    log('Shortcut triggered!');
    // 如果窗口不存在则创建
    if (!historyWindow) {
      log('Creating history window');
      createHistoryWindow();
      return;
    }

    if (historyWindow.isVisible()) {
      log('History window is visible, hiding it');
      historyWindow.hide();
    } else {
      log('History window is not 111 visible, showing it');
      // 重新设置窗口位置
      try {
        const mousePoint = screen.getCursorScreenPoint();
        const display = screen.getDisplayNearestPoint(mousePoint);
        const windowBounds = historyWindow.getBounds();
        let x = mousePoint.x - windowBounds.width / 2;
        let y = mousePoint.y + 10;

        // 确保窗口不会超出显示器边界
        x = Math.max(display.bounds.x, Math.min(x, display.bounds.x + display.bounds.width - windowBounds.width));
        y = Math.max(display.bounds.y, Math.min(y, display.bounds.y + display.bounds.height - windowBounds.height));

        historyWindow.setBounds({
          x: Math.round(x),
          y: Math.round(y),
          width: windowBounds.width,
          height: windowBounds.height
        });
      } catch (error) {
        log('Error setting window position:', error);
        historyWindow.center();
      }

      historyWindow.show();
      historyWindow.focus();
    }
  };
}

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

  const defaultShortcut = isMac ? 'Command+Shift+V' : 'Ctrl+Shift+V';
  
  // 获取设置的快捷键
  ipcMain.handle('get-shortcut', () => {
    log('Getting current shortcut');
    const settings = store.get('settings') as StoreSchema['settings'];
    const shortcut = settings?.shortcut || defaultShortcut;
    log('Current shortcut:', shortcut);
    return shortcut;
  })

  // 处理设置快捷键
  ipcMain.handle('set-shortcut', async (_, shortcut: string) => {
    try {
      log('Setting new shortcut:', shortcut);
      
      // 先注销所有快捷键
      log('Unregistering all shortcuts');
      globalShortcut.unregisterAll();
      
      if (shortcut === '') {
        return false;
      }
      // 注册新的快捷键
      log('Registering new shortcut:', shortcut);
      const success = globalShortcut.register(shortcut, registerShortcutHandler());
      log('New shortcut registration success:', success);
      
      // 检查快捷键是否已注册
      log('Checking if new shortcut is registered');
      const isRegistered = globalShortcut.isRegistered(shortcut);
      log('Is new shortcut registered?', shortcut, ':', isRegistered);

      if (!success) {
        log('Failed to register new shortcut, reverting to default');
        // 如果注册失败，重新注册默认快捷键
        log('Registering default shortcut:', defaultShortcut);
        const registered = globalShortcut.register(defaultShortcut, registerShortcutHandler());
        log('Default shortcut registration:', registered);
        
        const settings = store.get('settings') as StoreSchema['settings'];
        store.set('settings', {
          ...settings,
          shortcut: defaultShortcut
        });
        return false;
      }

      // 保存新的快捷键
      log('Saving new shortcut');
      const currentSettings = store.get('settings') as StoreSchema['settings'];
      const newSettings = {
        ...currentSettings,
        shortcut: shortcut
      };
      store.set('settings', newSettings);
      
      log('New settings saved:', store.get('settings'));
      return true;
    } catch (error) {
      log('Error setting shortcut:', error);
      // 如果出错，重新注册默认快捷键
      log('Registering default shortcut:', defaultShortcut);
      globalShortcut.register(defaultShortcut, registerShortcutHandler());
      const settings = store.get('settings') as StoreSchema['settings'];
      store.set('settings', {
        ...settings,
        shortcut: defaultShortcut
      });
      return false;
    }
  });

  // 关闭历史窗口
  ipcMain.handle('close-history-window', () => {
    if (historyWindow) {
      historyWindow.hide()
    }
  })

  // 处理注销快捷键的 IPC 请求
  ipcMain.on('unregister-shortcut', () => {
    globalShortcut.unregisterAll();
    console.log('All shortcuts unregistered');
  });

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
    await createWindow(); // 使用已有的 createWindow 函数
    return true;
  });

  // 添加关闭设置窗口的处理程序
  ipcMain.handle('close-settings-window', () => {
    if (mainWindow) {
      mainWindow.hide();
    }
    return true;
  });

  // 注册 Store 相关的处理程序
  registerStoreHandlers();
}

// 注册快捷键
function registerShortcuts() {
  const defaultShortcut = isMac ? 'CommandOrControl+Shift+V' : 'Ctrl+Shift+V';
  const settings = store.get('settings') as StoreSchema['settings'];
  const currentShortcut = settings?.shortcut || defaultShortcut;
  log('Using shortcut:', currentShortcut);
  
  // 先注销当前快捷键
  if (globalShortcut.isRegistered(currentShortcut)) {
    log('Unregistering current shortcut');
    globalShortcut.unregister(currentShortcut);
  }
  
  try {
    // 注册快捷键
    log('Registering shortcut:', currentShortcut);
    const success = globalShortcut.register(currentShortcut, registerShortcutHandler());
    log('Shortcut registration success:', success);
    
    if (!success) {
      log('Failed to register shortcut');
    }
  } catch (error) {
    log('Error during shortcut registration:', error);
  }
}

// 广播剪贴板变化到所有窗口
function broadcastClipboardChange(item: ClipboardItem) {
  if (mainWindow) {
    mainWindow.webContents.send('clipboard-change', item);
  }
  if (historyWindow) {
    historyWindow.webContents.send('clipboard-change', item);
  }
}

// 创建历史记录窗口
async function createHistoryWindow() {
  console.log('Creating history window...');

  // 如果窗口已存在，直接返回
  if (historyWindow) {
    return;
  }

  // 创建新窗口
  historyWindow = new BrowserWindow({
    width: 600,
    height: 800,
    icon: path.join(__dirname, '../public/icons/logo_dock.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
      sandbox: false,
    },
    frame: false,  // 移除窗口边框
    transparent: true,  // 允许透明
    show: false,
    alwaysOnTop: true,
    vibrancy: 'menu',  // 添加毛玻璃效果（仅在 macOS 上生效）
    visualEffectState: 'active',  // 保持毛玻璃效果活跃（仅在 macOS 上生效）
    roundedCorners: true,  // 圆角窗口（仅在 macOS 上生效）
  });

  console.log('Loading URL for history window...');

  // 添加 ESC 键监听
  historyWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && !input.alt && !input.control && !input.shift && !input.meta) {
      log('ESC key pressed, hiding history window');
      historyWindow?.hide();
      // 重新注册快捷键
      setTimeout(() => {
        log('Re-registering shortcuts after ESC');
        registerShortcuts();
      }, 100);
    }
  });

  // 监听窗口隐藏事件
  historyWindow.on('hide', () => {
    log('History window hidden');
    // 重新注册快捷键
    setTimeout(() => {
      log('Re-registering shortcuts after hide');
      registerShortcuts();
    }, 100);
  });

  // 返回一个 Promise，确保窗口完全加载
  return new Promise<void>(async (resolve, reject) => {
    try {
      // 监听页面加载完成事件
      historyWindow!.webContents.once('did-finish-load', () => {
        console.log('Page finished loading');
        if (historyWindow) {
          historyWindow.show();
          historyWindow.focus();
          // 短暂延时后关闭置顶
          setTimeout(() => {
            if (historyWindow) {
              historyWindow.setAlwaysOnTop(false);
            }
          }, 300);
          console.log('History window is now visible and focused');
          resolve();
        }
      });

      // 监听加载失败事件
      historyWindow!.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load:', errorCode, errorDescription);
        reject(new Error(`Failed to load: ${errorDescription}`));
      });

      // 在开发环境中，尝试连接到 Vite 开发服务器
      const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';
      if (isDev) {
        const devServerUrl = 'http://localhost:5173';
        console.log('Development mode - Loading URL:', devServerUrl);
        try {
          await historyWindow!.loadURL(devServerUrl);
          console.log('Successfully loaded dev server URL');
        } catch (error) {
          console.error('Failed to load dev server URL, falling back to file:', error);
          // 如果连接开发服务器失败，回退到加载本地文件
          const filePath = path.join(__dirname, '../dist/index.html');
          await historyWindow!.loadFile(filePath);
        }
      } else {
        // 生产环境直接加载本地文件
        const filePath = path.join(__dirname, '../dist/index.html');
        console.log('Production mode - Loading file:', filePath);
        await historyWindow!.loadFile(filePath);
      }
      console.log('URL loaded successfully');

      // 监听窗口关闭事件
      historyWindow!.on('closed', () => {
        console.log('History window closed');
        historyWindow = null;
      });

      // 监听窗口失去焦点事件
      historyWindow!.on('blur', () => {
        log('History window lost focus');
        if (historyWindow && !historyWindow.webContents.isDevToolsOpened()) {
          historyWindow.hide();
          // 重新注册快捷键
          setTimeout(() => {
            log('Re-registering shortcuts after blur');
            registerShortcuts();
          }, 100);
        }
      });

    } catch (error) {
      console.error('Error loading history window:', error);
      reject(error);
    }
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
      click: () => {
        createWindow();
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

// 创建主窗口（设置页面）
async function createWindow() {
  // 如果窗口已经存在但被隐藏，则重新创建
  if (mainWindow) {
    // 如果窗口已经被销毁或为 null，则重新创建
    if (mainWindow.isDestroyed() || mainWindow === null) {
      mainWindow = null;
    } else {
      // 如果窗口存在但隐藏，显示窗口
      mainWindow.show();
      mainWindow.focus();
      return;
    }
  }

  mainWindow = new BrowserWindow({
    width: 700,
    height: 480,
    icon: path.join(__dirname, '../public/icons/logo_dock.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
      sandbox: false,
    }
  });

  try {
    // 在开发环境中，尝试连接到 Vite 开发服务器
    const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';
    if (isDev) {
      const devServerUrl = 'http://localhost:5173';
      console.log('Development mode - Loading URL:', devServerUrl);
      try {
        await mainWindow.loadURL(`${devServerUrl}/#/settings`);
        console.log('Successfully loaded dev server URL');
        // 开发环境下打开开发者工具
        // 只在开发模式下打开 DevTools，且需要设置环境变量
        if (process.env.OPEN_DEV_TOOLS === 'true') {
          mainWindow.webContents.openDevTools();
        }
      } catch (error) {
        console.error('Failed to load dev server URL, falling back to file:', error);
        // 如果连接开发服务器失败，回退到加载本地文件
        const filePath = path.join(__dirname, '../dist/index.html');
        await mainWindow.loadFile(filePath, {
          hash: '/settings'
        });
      }
    } else {
      // 生产环境直接加载本地文件
      const filePath = path.join(__dirname, '../dist/index.html');
      console.log('Production mode - Loading file:', filePath);
      await mainWindow.loadFile(filePath, {
        hash: '/settings'
      });
    }
    console.log('URL loaded successfully');

    // 显示窗口
    mainWindow.show();
    mainWindow.focus();
  } catch (error) {
    console.error('Error loading main window:', error);
  }

  // 监听窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 监听窗口隐藏事件
  mainWindow.on('close', (event) => {
    event.preventDefault(); // 阻止默认关闭行为
    mainWindow?.hide(); // 隐藏窗口而不是关闭
  });
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
  console.log('App is ready, initializing...');
  
  // 在 macOS 上设置 Dock 图标
  if (isMac) {
    // app.dock.hide(); // 注释掉这行，让 Dock 图标显示
    app.dock.setIcon(path.join(__dirname, '../public/icons/logo_dock.png'));
  }
  
  // 检查快捷键是否被其他应用占用
  const shortcut = store.get('settings.shortcut') as string;
  if (globalShortcut.isRegistered(shortcut)) {
    log('Warning: Shortcut is already registered by another application');
    globalShortcut.unregisterAll();
    log('Unregistered all shortcuts');
  }
  
  // 注册 IPC 处理程序
  registerIpcHandlers();
  
  // 注册快捷键
  registerShortcuts();
  
  // 创建主窗口
  await createWindow();

  // 创建托盘图标
  createTrayIcon();

  // 开始监听剪贴板
  startClipboardMonitoring();

  app.on('activate', async () => {
    if (!mainWindow) {
      await createWindow();
    } else {
      mainWindow.show();
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
    mainWindow = null;
    historyWindow = null;
    // tray = null;
  });
});

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit();
  }
});
