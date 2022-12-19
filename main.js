const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let win;

const createWindow = () => {
  win = new BrowserWindow({
    width: 1200,
    height: 600,
    resizable: false,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile("src/index.html");

  win.webContents.openDevTools({ mode: "detach" });
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  if (process.platform === "win32") app.setAppUserModelId(app.getName());
});

//lifecycle
app.on("window-all-closed", () => {
  if (process.platform === "darwin") app.dock.hide();
});

//window control
ipcMain.on("close", () => {
  win.close();
});

ipcMain.on("minimize", () => {
  win.minimize();
});

ipcMain.on("reload", async (event, args) => {
  win.webContents.reloadIgnoringCache();
});

ipcMain.on("dev-tools", (event, args) => {
  win.webContents.openDevTools({ mode: "detach" });
});
