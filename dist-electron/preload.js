"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
  onClipboardChange: (callback) => {
    ipcRenderer.on("clipboard-change", (_event, content) => callback(content));
    return () => {
      ipcRenderer.removeAllListeners("clipboard-change");
    };
  },
  getClipboardHistory: () => ipcRenderer.invoke("get-clipboard-history"),
  saveToClipboard: (text) => ipcRenderer.invoke("save-to-clipboard", text)
});
