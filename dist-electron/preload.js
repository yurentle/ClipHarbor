"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
  onClipboardChange: (callback) => {
    const subscription = (_event, content) => callback(content);
    ipcRenderer.on("clipboard-change", subscription);
    return () => {
      ipcRenderer.removeListener("clipboard-change", subscription);
    };
  },
  getClipboardHistory: () => ipcRenderer.invoke("get-clipboard-history"),
  saveToClipboard: (item) => ipcRenderer.invoke("save-to-clipboard", item),
  removeFromHistory: (id) => ipcRenderer.invoke("remove-from-history", id),
  toggleFavorite: (id) => ipcRenderer.invoke("toggle-favorite", id)
});
