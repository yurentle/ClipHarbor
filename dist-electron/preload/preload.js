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
  saveToClipboard: (text) => ipcRenderer.invoke("save-to-clipboard", text),
  removeFromHistory: (text) => ipcRenderer.invoke("remove-from-history", text)
});
