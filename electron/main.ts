import { app, BrowserWindow, clipboard, ipcMain, nativeImage, globalShortcut } from 'electron';
import path from 'path';
import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';

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
    clipboardHistory: []
  }
})

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

// 注册所有的 IPC 处理程序
function registerIpcHandlers() {
  // 获取剪贴板历史
  ipcMain.handle('get-clipboard-history', () => {
    return store.get('clipboardHistory', [])
  })

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
    return true;
  });

  // 切换托盘图标显示
  ipcMain.handle('toggle-tray', async (_, show: boolean) => {
    if (tray) {
      tray.setVisible(show);
    }
    return true;
  });

  // 获取默认快捷键
  ipcMain.handle('get-default-shortcut', () => {
    return process.platform === 'darwin' ? 'Command+Shift+V' : 'Ctrl+Shift+V'
  })
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
    alwaysOnTop: true,
  });

  console.log('Loading URL for history window...');

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

// 注册快捷键
function registerShortcuts() {
  console.log('Registering shortcuts...');
  
  // 先注销所有快捷键
  globalShortcut.unregisterAll();
  console.log('All shortcuts unregistered');
  
  const shortcut = process.platform === 'darwin' ? 'CommandOrControl+Shift+V' : 'CommandOrControl+Shift+V';
  console.log('Attempting to register shortcut:', shortcut);
  
  try {
    const registered = globalShortcut.register(shortcut, async () => {
      console.log('Shortcut triggered! Creating/showing history window...');
      
      try {
        if (!historyWindow) {
          console.log('No history window exists, creating new one...');
          await createHistoryWindow();
        } else {
          console.log('History window exists, showing it...');
          historyWindow.show();
          historyWindow.focus();
          historyWindow.setAlwaysOnTop(true);
          setTimeout(() => {
            if (historyWindow) {
              historyWindow.setAlwaysOnTop(false);
            }
          }, 300);
        }
      } catch (error) {
        console.error('Error handling shortcut:', error);
      }
    });

    if (!registered) {
      console.error('快捷键注册失败:', shortcut);
    } else {
      console.log('快捷键注册成功:', shortcut);
    }
  } catch (error) {
    console.error('注册快捷键时出错:', error);
  }
}

// 创建主窗口（设置页面）
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  try {
    // 在开发环境中，尝试连接到 Vite 开发服务器
    const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';
    if (isDev) {
      // 默认的 Vite 开发服务器地址
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
  } catch (error) {
    console.error('Error loading main window:', error);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 监听剪贴板变化
  let lastContent = ''
  let lastImage: string | null = null
  
  setInterval(async () => {
    try {
      // 检查是否有文件路径
      const filePaths = clipboard.readBuffer('FileNameW').toString('ucs2').replace(/\0/g, '').trim()
      if (filePaths) {
        const paths = filePaths.split('\r\n').filter(Boolean)
        if (paths.length > 0) {
          const history = store.get('clipboardHistory', []) as ClipboardItem[]
          const newItem: ClipboardItem = {
            id: uuidv4(),
            content: paths.join('\n'),
            type: 'file',
            timestamp: Date.now(),
            favorite: false
          }
          const newHistory = [newItem, ...history.filter(item => item.content !== newItem.content)].slice(0, 50)
          store.set('clipboardHistory', newHistory)
          mainWindow.webContents.send('clipboard-change', newItem)
          return
        }
      }

      // 检查是否有图片
      const image = clipboard.readImage()
      if (!image.isEmpty()) {
        const dataUrl = image.toDataURL()
        if (dataUrl !== lastImage) {
          lastImage = dataUrl
          const metadata = getImageMetadata(dataUrl)
          const history = store.get('clipboardHistory', []) as ClipboardItem[]
          const newItem: ClipboardItem = {
            id: uuidv4(),
            content: dataUrl,
            type: 'image',
            timestamp: Date.now(),
            favorite: false,
            metadata
          }
          const newHistory = [newItem, ...history.filter(i => i.content !== dataUrl)].slice(0, 50)
          store.set('clipboardHistory', newHistory)
          mainWindow.webContents.send('clipboard-change', newItem)
        }
      } else if (clipboard.readText() && clipboard.readText() !== lastContent) {
        lastContent = clipboard.readText()
        const history = store.get('clipboardHistory', []) as ClipboardItem[]
        const newItem: ClipboardItem = {
          id: uuidv4(),
          content: clipboard.readText(),
          type: 'text',
          timestamp: Date.now(),
          favorite: false
        }
        const newHistory = [newItem, ...history.filter(i => i.content !== newItem.content)].slice(0, 50)
        store.set('clipboardHistory', newHistory)
        mainWindow.webContents.send('clipboard-change', newItem)
      }
    } catch (error) {
      console.error('Error reading clipboard:', error)
    }
  }, 1000)
}

app.whenReady().then(async () => {
  console.log('App is ready, initializing...');
  
  // 注册 IPC 处理程序
  registerIpcHandlers();

  // 创建主窗口
  await createWindow();
  
  // 注册快捷键
  registerShortcuts();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });

  // 开始监听剪贴板变化
  // startClipboardMonitoring();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// 当所有窗口关闭时，清理引用
app.on('before-quit', () => {
  mainWindow = null
  historyWindow = null
})
