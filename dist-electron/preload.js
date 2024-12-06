"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  onClipboardChange: (callback) => {
    const eventHandler = (_, content) => callback(content);
    electron.ipcRenderer.on("clipboard-change", eventHandler);
    return () => {
      electron.ipcRenderer.removeListener("clipboard-change", eventHandler);
    };
  },
  getClipboardHistory: () => electron.ipcRenderer.invoke("get-clipboard-history"),
  saveToClipboard: (item) => electron.ipcRenderer.invoke("save-to-clipboard", item),
  removeFromHistory: (id) => electron.ipcRenderer.invoke("remove-from-history", id),
  toggleFavorite: (id) => electron.ipcRenderer.invoke("toggle-favorite", id),
  toggleDock: (show) => electron.ipcRenderer.invoke("toggle-dock", show),
  toggleTray: (show) => electron.ipcRenderer.invoke("toggle-tray", show),
  getDefaultShortcut: () => electron.ipcRenderer.invoke("get-default-shortcut"),
  closeHistoryWindow: () => electron.ipcRenderer.invoke("close-history-window"),
  toggleDockIcon: (show) => electron.ipcRenderer.invoke("toggle-dock-icon", show),
  toggleTrayIcon: (show) => electron.ipcRenderer.invoke("toggle-tray-icon", show)
});
