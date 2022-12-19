const { ipcRenderer, contextBridge } = require("electron");

const APP = {
  close: () => ipcRenderer.send("close"),
  minimize: () => ipcRenderer.send("minimize"),
  reload: () => ipcRenderer.send("reload"),
  loadPage: (id) => ipcRenderer.send("page", id),
  devTools: () => ipcRenderer.send("dev-tools"),
};

contextBridge.exposeInMainWorld("app", APP);
