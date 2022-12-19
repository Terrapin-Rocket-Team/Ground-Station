const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { debug } = require("./debug");

let mainWin, debugWin;

const createWindow = () => {
  mainWin = new BrowserWindow({
    width: 1200,
    height: 600,
    resizable: false,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWin.loadFile("src/index.html");

  mainWin.webContents.openDevTools({ mode: "detach" });
};

const createDebug = () => {
  debugWin = new BrowserWindow({
    width: 600,
    height: 400,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  debug.setWin(debugWin);

  debugWin.loadFile("src/debug/debug.html");

  debugWin.webContents.openDevTools({ mode: "detach" });
};

app.whenReady().then(() => {
  //createWindow();
  createDebug();

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

let counter = 0;
setInterval(() => {
  debug.println("test" + counter++);
}, 100);
