import { app, BrowserWindow, clipboard, ipcMain, nativeImage, globalShortcut, Tray, Menu } from 'electron';
import path from 'path';
import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';

declare global {
  var clipboardInterval: NodeJS.Timeout | undefined;
}

// 定义剪贴板项的类型
interface ClipboardItem {
  id: string
  content: string
  type: 'text' | 'image' | 'file'
  timestamp: number
  favorite: boolean
  metadata?: {
    width?: number
    height?: number
    size?: number
  }
}

const store = new Store({
  name: 'clipboard-history',
  defaults: {
    clipboardHistory: [],
    settings: {
      shortcut: process.platform === 'darwin' ? 'Command+Shift+V' : 'Ctrl+Shift+V',
      showDockIcon: true,
      showTrayIcon: true,
      retentionPeriod: 30,
      retentionUnit: 'days'
    }
  },
  clearInvalidConfig: false, // 不清除无效配置
  watch: true // 监听配置变化
});

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

let mainWindow: BrowserWindow | null = null
let historyWindow: BrowserWindow | null = null
let tray: Tray | null = null;

// 注册快捷键处理函数
function registerShortcutHandler() {
  return () => {
    if (historyWindow?.isVisible()) {
      historyWindow.hide();
    } else {
      createHistoryWindow();
      historyWindow?.show();
    }
  };
}

// 注册所有的 IPC 处理程序
function registerIpcHandlers() {
  // 获取剪贴板历史
  ipcMain.handle('get-clipboard-history', () => {
    return store.get('clipboardHistory', [])
  })

  // 处理 Dock 显示设置
  ipcMain.handle('toggle-dock-icon', (_, show: boolean) => {
    if (process.platform === 'darwin') {
      if (show) {
        app.dock.show().then(() => {
          // 显示后重新设置图标
          app.dock.setIcon(path.join(__dirname, '../public/logo_dock.png'));
        });
      } else {
        app.dock.hide();
      }
    }
    store.set('settings.showDockIcon', show);
    return show;
  });

  // 处理状态栏图标显示设置
  ipcMain.handle('toggle-tray-icon', (_, show: boolean) => {
    if (show && !tray) {
      tray = new Tray(path.join(__dirname, '../public/logo_tray.png'));
      const contextMenu = Menu.buildFromTemplate([
        { label: 'Show App', click: () => { mainWindow?.show(); } },
        { label: 'Quit', click: () => { app.quit(); } }
      ]);
      tray.setToolTip('ClipHarbor');
      tray.setContextMenu(contextMenu);
    } else if (!show && tray) {
      tray.destroy();
      tray = null;
    }
    store.set('settings.showTrayIcon', show);
    return show;
  });

  // 保存到剪贴板
  ipcMain.handle('save-to-clipboard', (_, item: ClipboardItem) => {
    if (item.type === 'image') {
      const image = clipboard.readImage().create(item.content)
      clipboard.writeImage(image)
    } else {
      clipboard.writeText(item.content)
    }
    return true
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

  // 切换 Dock 显示
  ipcMain.handle('toggle-dock', async (_, show: boolean) => {
    if (process.platform === 'darwin') {
      if (show) {
        app.dock.show();
      } else {
        app.dock.hide();
      }
    }
    store.set('settings.showDockIcon', show);
    return true;
  });

  // 切换托盘图标显示
  ipcMain.handle('toggle-tray', async (_, show: boolean) => {
    if (tray) {
      tray.setVisible(show);
    }
    store.set('settings.showTrayIcon', show);
    return true;
  });

  const defaultShortcut = process.platform === 'darwin' ? 'Command+Shift+V' : 'Ctrl+Shift+V';
  
  // 获取设置的快捷键
  ipcMain.handle('get-shortcut', () => {
    log('Getting current shortcut');
    const settings = store.get('settings');
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
        
        store.set('settings', {
          ...store.get('settings'),
          shortcut: defaultShortcut
        });
        return false;
      }

      // 保存新的快捷键
      log('Saving new shortcut');
      const currentSettings = store.get('settings') || {};
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
      store.set('settings', {
        ...store.get('settings'),
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
  ipcMain.handle('getStoreValue', (_, key: string) => {
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
  ipcMain.handle('setStoreValue', (_, key: string, value: any) => {
    try {
      store.set(`settings.${key}`, value);
      log(`Setting store value for ${key}:`, value);
      return true;
    } catch (error) {
      log(`Error setting store value for ${key}:`, error);
      return false;
    }
  });
}

// 注册快捷键
function registerShortcuts() {
  const defaultShortcut = process.platform === 'darwin' ? 'Command+Shift+V' : 'Ctrl+Shift+V';
  
  // Debug: 打印 store 中的所有数据
  log('All store data:', JSON.stringify(store.store, null, 2));
  
  const settings = store.get('settings');
  log('Current settings:', JSON.stringify(settings, null, 2));
  
  const currentShortcut = settings?.shortcut || defaultShortcut;
  log('Using shortcut:', currentShortcut);
  
  // 注销所有已注册的快捷键
  log('Unregistering all shortcuts');
  globalShortcut.unregisterAll();
  
  try {
    // 注册保存的快捷键
    log('Registering shortcut:', currentShortcut);
    const success = globalShortcut.register(currentShortcut, registerShortcutHandler());
    log('Shortcut registration success:', success);
    
    // 检查快捷键是否已注册
    log('Checking if shortcut is registered');
    const isRegistered = globalShortcut.isRegistered(currentShortcut);
    log('Is shortcut registered?', currentShortcut, ':', isRegistered);
    
    // 如果注册失败，使用默认快捷键
    if (!success) {
      log('Failed to register saved shortcut, trying default:', defaultShortcut);
      log('Registering default shortcut:', defaultShortcut);
      const registered = globalShortcut.register(defaultShortcut, registerShortcutHandler());
      log('Default shortcut registration:', registered);
      
      if (registered) {
        const currentSettings = store.get('settings') || {};
        store.set('settings', {
          ...currentSettings,
          shortcut: defaultShortcut
        });
        log('Default shortcut registered and saved');
      } else {
        log('Failed to register default shortcut');
      }
    }
  } catch (error) {
    log('Error during shortcut registration:', error);
  }
}

// 存储当前快捷键
let currentShortcut = process.platform === 'darwin' ? 'Command+Shift+V' : 'Ctrl+Shift+V';

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

  // 如果已经存在窗口，先销毁它
  if (historyWindow) {
    console.log('Destroying existing history window...');
    historyWindow.destroy();
    historyWindow = null;
  }

  // 创建新窗口
  historyWindow = new BrowserWindow({
    width: 600,
    height: 800,
    icon: path.join(__dirname, '../public/logo_dock.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
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
      historyWindow?.hide();
    }
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
        await historyWindow!.loadURL(devServerUrl);
      } else {
        const filePath = path.join(__dirname, '../dist/index.html');
        console.log('Production mode - Loading file:', filePath);
        await historyWindow!.loadFile(filePath);
      }

      // 监听窗口关闭事件
      historyWindow!.on('closed', () => {
        console.log('History window closed');
        historyWindow = null;
      });

      // 监听窗口失去焦点事件
      historyWindow!.on('blur', () => {
        if (historyWindow && !historyWindow.webContents.isDevToolsOpened()) {
          historyWindow.hide();
        }
      });

    } catch (error) {
      console.error('Error loading history window:', error);
      reject(error);
    }
  });
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
    icon: path.join(__dirname, '../public/logo_dock.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
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
        mainWindow.webContents.openDevTools();
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
              type: 'file',
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
  
  // 注册 IPC 处理程序
  registerIpcHandlers();
  
  // 注册快捷键
  registerShortcuts();
  
  // 创建主窗口
  await createWindow();
  
  // 设置 Tray 图标
  tray = new Tray(path.join(__dirname, '../public/logo_tray.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => { mainWindow?.show(); } },
    { label: 'Quit', click: () => { app.quit(); } }
  ]);
  tray.setToolTip('ClipHarbor');
  tray.setContextMenu(contextMenu);
  
  // 开始监听剪贴板
  startClipboardMonitoring();
  
  if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, '../public/logo_dock.png'));
  }

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
    tray = null;
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
