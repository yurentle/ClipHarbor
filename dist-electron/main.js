"use strict";
const { app, BrowserWindow, clipboard, ipcMain } = require("electron");
const path = require("path");
const Store = require("electron-store");
const store = new Store({
  name: "clipboard-history",
  defaults: {
    clipboardHistory: []
  }
});
const __dirname$1 = path.dirname(__filename);
async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname$1, "../dist/index.html"));
  }
  let lastClipboardContent = clipboard.readText();
  setInterval(() => {
    const filePaths = clipboard.readBuffer("FileNameW").toString("ucs2").replace(/\0/g, "").trim();
    if (filePaths) {
      const paths = filePaths.split("\r\n").filter(Boolean);
      if (paths.length > 0) {
        const history = store.get("clipboardHistory", []);
        const newItem = {
          id: Date.now().toString(),
          content: paths.join("\n"),
          type: "file",
          timestamp: Date.now(),
          favorite: false
        };
        const newHistory = [newItem, ...history.filter((item) => item.content !== newItem.content)].slice(0, 50);
        store.set("clipboardHistory", newHistory);
        mainWindow.webContents.send("clipboard-change", newItem);
        return;
      }
    }
    const image = clipboard.readImage();
    if (!image.isEmpty()) {
      const history = store.get("clipboardHistory", []);
      const newItem = {
        id: Date.now().toString(),
        content: image.toDataURL(),
        type: "image",
        timestamp: Date.now(),
        favorite: false
      };
      const newHistory = [newItem, ...history.filter((item) => item.content !== newItem.content)].slice(0, 50);
      store.set("clipboardHistory", newHistory);
      mainWindow.webContents.send("clipboard-change", newItem);
      return;
    }
    const currentContent = clipboard.readText();
    if (currentContent && currentContent !== lastClipboardContent) {
      lastClipboardContent = currentContent;
      const history = store.get("clipboardHistory", []);
      const newItem = {
        id: Date.now().toString(),
        content: currentContent,
        type: "text",
        timestamp: Date.now(),
        favorite: false
      };
      const newHistory = [newItem, ...history.filter((item) => item.content !== newItem.content)].slice(0, 50);
      store.set("clipboardHistory", newHistory);
      mainWindow.webContents.send("clipboard-change", newItem);
    }
  }, 1e3);
  ipcMain.handle("get-clipboard-history", () => {
    return store.get("clipboardHistory", []);
  });
  ipcMain.handle("save-to-clipboard", (_, item) => {
    if (item.type === "image") {
      const image = clipboard.readImage().create(item.content);
      clipboard.writeImage(image);
    } else {
      clipboard.writeText(item.content);
    }
    return true;
  });
  ipcMain.handle("remove-from-history", (_, id) => {
    const history = store.get("clipboardHistory", []);
    const newHistory = history.filter((item) => item.id !== id);
    store.set("clipboardHistory", newHistory);
    return true;
  });
  ipcMain.handle("toggle-favorite", (_, id) => {
    const history = store.get("clipboardHistory", []);
    const newHistory = history.map(
      (item) => item.id === id ? { ...item, favorite: !item.favorite } : item
    );
    store.set("clipboardHistory", newHistory);
    return true;
  });
}
app.whenReady().then(async () => {
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
