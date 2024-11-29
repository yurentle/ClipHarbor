const { app, BrowserWindow, clipboard, ipcMain } = require('electron')
const path = require('path')
const Store = require('electron-store')

// 定义剪贴板项的类型
interface ClipboardItem {
  id: string
  content: string
  type: 'text' | 'image' | 'file'
  timestamp: number
  favorite: boolean
}

const store = new Store({
  name: 'clipboard-history',
  defaults: {
    clipboardHistory: []
  }
})

const __dirname = path.dirname(__filename)

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 监听剪贴板变化
  let lastClipboardContent = clipboard.readText()
  setInterval(() => {
    // 检查是否有文件路径
    const filePaths = clipboard.readBuffer('FileNameW').toString('ucs2').replace(/\0/g, '').trim()
    if (filePaths) {
      const paths = filePaths.split('\r\n').filter(Boolean)
      if (paths.length > 0) {
        const history = store.get('clipboardHistory', []) as ClipboardItem[]
        const newItem: ClipboardItem = {
          id: Date.now().toString(),
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
      const history = store.get('clipboardHistory', []) as ClipboardItem[]
      const newItem: ClipboardItem = {
        id: Date.now().toString(),
        content: image.toDataURL(),
        type: 'image',
        timestamp: Date.now(),
        favorite: false
      }
      const newHistory = [newItem, ...history.filter(item => item.content !== newItem.content)].slice(0, 50)
      store.set('clipboardHistory', newHistory)
      mainWindow.webContents.send('clipboard-change', newItem)
      return
    }

    // 检查文本内容
    const currentContent = clipboard.readText()
    if (currentContent && currentContent !== lastClipboardContent) {
      lastClipboardContent = currentContent
      const history = store.get('clipboardHistory', []) as ClipboardItem[]
      const newItem: ClipboardItem = {
        id: Date.now().toString(),
        content: currentContent,
        type: 'text',
        timestamp: Date.now(),
        favorite: false
      }
      const newHistory = [newItem, ...history.filter(item => item.content !== newItem.content)].slice(0, 50)
      store.set('clipboardHistory', newHistory)
      mainWindow.webContents.send('clipboard-change', newItem)
    }
  }, 1000)

  // IPC 通信处理
  ipcMain.handle('get-clipboard-history', () => {
    return store.get('clipboardHistory', [])
  })

  ipcMain.handle('save-to-clipboard', (_, item: ClipboardItem) => {
    if (item.type === 'image') {
      const image = clipboard.readImage().create(item.content)
      clipboard.writeImage(image)
    } else {
      clipboard.writeText(item.content)
    }
    return true
  })

  ipcMain.handle('remove-from-history', (_, id: string) => {
    const history = store.get('clipboardHistory', []) as ClipboardItem[]
    const newHistory = history.filter(item => item.id !== id)
    store.set('clipboardHistory', newHistory)
    return true
  })

  ipcMain.handle('toggle-favorite', (_, id: string) => {
    const history = store.get('clipboardHistory', []) as ClipboardItem[]
    const newHistory = history.map(item => 
      item.id === id ? { ...item, favorite: !item.favorite } : item
    )
    store.set('clipboardHistory', newHistory)
    return true
  })
}

app.whenReady().then(async () => {
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
