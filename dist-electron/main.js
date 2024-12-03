"use strict";
const electron = require("electron");
const path = require("path");
const Store = require("electron-store");
const crypto = require("crypto");
const byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
const rnds8Pool = new Uint8Array(256);
let poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    crypto.randomFillSync(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}
const native = { randomUUID: crypto.randomUUID };
function v4(options, buf, offset) {
  if (native.randomUUID && !buf && !options) {
    return native.randomUUID();
  }
  options = options || {};
  const rnds = options.random || (options.rng || rng)();
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  return unsafeStringify(rnds);
}
const store = new Store({
  name: "clipboard-history",
  defaults: {
    clipboardHistory: []
  }
});
const __dirname$1 = path.dirname(__filename);
function getImageMetadata(dataUrl) {
  const img = electron.nativeImage.createFromDataURL(dataUrl);
  const size = Buffer.from(dataUrl.split(",")[1], "base64").length;
  const { width, height } = img.getSize();
  return {
    width,
    height,
    size
  };
}
let mainWindow = null;
let historyWindow = null;
function registerIpcHandlers() {
  electron.ipcMain.handle("get-clipboard-history", () => {
    return store.get("clipboardHistory", []);
  });
  electron.ipcMain.handle("save-to-clipboard", (_, item) => {
    if (item.type === "image") {
      const image = electron.clipboard.readImage().create(item.content);
      electron.clipboard.writeImage(image);
    } else {
      electron.clipboard.writeText(item.content);
    }
    return true;
  });
  electron.ipcMain.handle("remove-from-history", (_, id) => {
    const history = store.get("clipboardHistory", []);
    const newHistory = history.filter((item) => item.id !== id);
    store.set("clipboardHistory", newHistory);
    return true;
  });
  electron.ipcMain.handle("toggle-favorite", (_, id) => {
    const history = store.get("clipboardHistory", []);
    const newHistory = history.map(
      (item) => item.id === id ? { ...item, favorite: !item.favorite } : item
    );
    store.set("clipboardHistory", newHistory);
    return true;
  });
  electron.ipcMain.handle("toggle-dock", async (_, show) => {
    if (process.platform === "darwin") {
      if (show) {
        electron.app.dock.show();
      } else {
        electron.app.dock.hide();
      }
    }
    return true;
  });
  electron.ipcMain.handle("toggle-tray", async (_, show) => {
    if (tray) {
      tray.setVisible(show);
    }
    return true;
  });
  electron.ipcMain.handle("get-default-shortcut", () => {
    return process.platform === "darwin" ? "Command+Shift+V" : "Ctrl+Shift+V";
  });
}
function broadcastClipboardChange(item) {
  if (mainWindow) {
    mainWindow.webContents.send("clipboard-change", item);
  }
  if (historyWindow) {
    historyWindow.webContents.send("clipboard-change", item);
  }
}
async function createHistoryWindow() {
  console.log("Creating history window...");
  if (historyWindow) {
    console.log("Destroying existing history window...");
    historyWindow.destroy();
    historyWindow = null;
  }
  historyWindow = new electron.BrowserWindow({
    width: 600,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    frame: false,
    // 移除窗口边框
    transparent: true,
    // 允许透明
    show: false,
    alwaysOnTop: true,
    vibrancy: "menu",
    // 添加毛玻璃效果（仅在 macOS 上生效）
    visualEffectState: "active",
    // 保持毛玻璃效果活跃（仅在 macOS 上生效）
    roundedCorners: true
    // 圆角窗口（仅在 macOS 上生效）
  });
  console.log("Loading URL for history window...");
  return new Promise(async (resolve, reject) => {
    try {
      historyWindow.webContents.once("did-finish-load", () => {
        console.log("Page finished loading");
        if (historyWindow) {
          historyWindow.show();
          historyWindow.focus();
          setTimeout(() => {
            if (historyWindow) {
              historyWindow.setAlwaysOnTop(false);
            }
          }, 300);
          console.log("History window is now visible and focused");
          resolve();
        }
      });
      historyWindow.webContents.once("did-fail-load", (event, errorCode, errorDescription) => {
        console.error("Failed to load:", errorCode, errorDescription);
        reject(new Error(`Failed to load: ${errorDescription}`));
      });
      const isDev = process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true";
      if (isDev) {
        const devServerUrl = "http://localhost:5173";
        console.log("Development mode - Loading URL:", devServerUrl);
        await historyWindow.loadURL(devServerUrl);
      } else {
        const filePath = path.join(__dirname$1, "../dist/index.html");
        console.log("Production mode - Loading file:", filePath);
        await historyWindow.loadFile(filePath);
      }
      historyWindow.on("closed", () => {
        console.log("History window closed");
        historyWindow = null;
      });
      historyWindow.on("blur", () => {
        if (historyWindow && !historyWindow.webContents.isDevToolsOpened()) {
          historyWindow.hide();
        }
      });
    } catch (error) {
      console.error("Error loading history window:", error);
      reject(error);
    }
  });
}
function registerShortcuts() {
  console.log("Registering shortcuts...");
  electron.globalShortcut.unregisterAll();
  console.log("All shortcuts unregistered");
  const shortcut = process.platform === "darwin" ? "CommandOrControl+Shift+V" : "CommandOrControl+Shift+V";
  console.log("Attempting to register shortcut:", shortcut);
  try {
    const registered = electron.globalShortcut.register(shortcut, async () => {
      console.log("Shortcut triggered! Creating/showing history window...");
      try {
        if (!historyWindow) {
          console.log("No history window exists, creating new one...");
          await createHistoryWindow();
        } else {
          console.log("History window exists, showing it...");
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
        console.error("Error handling shortcut:", error);
      }
    });
    if (!registered) {
      console.error("快捷键注册失败:", shortcut);
    } else {
      console.log("快捷键注册成功:", shortcut);
    }
  } catch (error) {
    console.error("注册快捷键时出错:", error);
  }
}
async function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });
  try {
    const isDev = process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true";
    if (isDev) {
      const devServerUrl = "http://localhost:5173";
      console.log("Development mode - Loading URL:", devServerUrl);
      try {
        await mainWindow.loadURL(`${devServerUrl}/#/settings`);
        console.log("Successfully loaded dev server URL");
        mainWindow.webContents.openDevTools();
      } catch (error) {
        console.error("Failed to load dev server URL, falling back to file:", error);
        const filePath = path.join(__dirname$1, "../dist/index.html");
        await mainWindow.loadFile(filePath, {
          hash: "/settings"
        });
      }
    } else {
      const filePath = path.join(__dirname$1, "../dist/index.html");
      console.log("Production mode - Loading file:", filePath);
      await mainWindow.loadFile(filePath, {
        hash: "/settings"
      });
    }
    console.log("URL loaded successfully");
  } catch (error) {
    console.error("Error loading main window:", error);
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function startClipboardMonitoring() {
  console.log("Starting clipboard monitoring...");
  let lastContent = "";
  let lastImage = "";
  setInterval(() => {
    try {
      const filePaths = electron.clipboard.readBuffer("FileNameW");
      if (filePaths.length > 0) {
        try {
          const files = electron.clipboard.readBuffer("FileNameW").toString("ucs2").replace(/\\/g, "/").split("\0").filter(Boolean);
          if (files.length > 0 && files.join(",") !== lastContent) {
            lastContent = files.join(",");
            const history = store.get("clipboardHistory", []);
            const newItem = {
              id: v4(),
              content: files.join(","),
              type: "file",
              timestamp: Date.now(),
              favorite: false
            };
            const newHistory = [newItem, ...history.filter((item) => item.content !== newItem.content)].slice(0, 50);
            store.set("clipboardHistory", newHistory);
            broadcastClipboardChange(newItem);
          }
        } catch (error) {
          console.error("Error processing file paths:", error);
        }
        return;
      }
      const image = electron.clipboard.readImage();
      if (!image.isEmpty()) {
        const dataUrl = image.toDataURL();
        if (dataUrl !== lastImage) {
          lastImage = dataUrl;
          const metadata = getImageMetadata(dataUrl);
          const history = store.get("clipboardHistory", []);
          const newItem = {
            id: v4(),
            content: dataUrl,
            type: "image",
            timestamp: Date.now(),
            favorite: false,
            metadata
          };
          const newHistory = [newItem, ...history.filter((i) => i.content !== dataUrl)].slice(0, 50);
          store.set("clipboardHistory", newHistory);
          broadcastClipboardChange(newItem);
        }
      } else {
        const text = electron.clipboard.readText();
        if (text && text !== lastContent) {
          lastContent = text;
          const history = store.get("clipboardHistory", []);
          const newItem = {
            id: v4(),
            content: text,
            type: "text",
            timestamp: Date.now(),
            favorite: false
          };
          const newHistory = [newItem, ...history.filter((i) => i.content !== newItem.content)].slice(0, 50);
          store.set("clipboardHistory", newHistory);
          broadcastClipboardChange(newItem);
        }
      }
    } catch (error) {
      console.error("Error reading clipboard:", error);
    }
  }, 1e3);
  console.log("Clipboard monitoring started");
}
electron.app.whenReady().then(async () => {
  console.log("App is ready, initializing...");
  registerIpcHandlers();
  await createWindow();
  registerShortcuts();
  electron.app.on("activate", async () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
  startClipboardMonitoring();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("will-quit", () => {
  electron.globalShortcut.unregisterAll();
});
electron.app.on("before-quit", () => {
  mainWindow = null;
  historyWindow = null;
});
