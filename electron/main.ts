const { app, BrowserWindow, clipboard, ipcMain } = require('electron')
const path = require('path')
const Store = require('electron-store')

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
    const currentContent = clipboard.readText()
    if (currentContent !== lastClipboardContent) {
      lastClipboardContent = currentContent
      // 更新 store
      const history = store.get('clipboardHistory', [])
      const newHistory = [currentContent, ...history.filter(item => item !== currentContent)].slice(0, 50)
      store.set('clipboardHistory', newHistory)
      // 通知渲染进程
      mainWindow.webContents.send('clipboard-change', currentContent)
    }
  }, 1000)

  // IPC 通信处理
  ipcMain.handle('get-clipboard-history', () => {
    return store.get('clipboardHistory', [])
  })

  ipcMain.handle('save-to-clipboard', (_, text) => {
    clipboard.writeText(text)
    const history = store.get('clipboardHistory', [])
    const newHistory = [text, ...history.filter(item => item !== text)].slice(0, 50)
    store.set('clipboardHistory', newHistory)
    return true
  })

  ipcMain.handle('remove-from-history', (_, text) => {
    const history = store.get('clipboardHistory', [])
    const newHistory = history.filter(item => item !== text)
    store.set('clipboardHistory', newHistory)
    mainWindow.webContents.send('clipboard-change', clipboard.readText())
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