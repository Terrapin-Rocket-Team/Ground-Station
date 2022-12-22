const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { log } = require("./debug");
const { radio } = require("./serial/serial");

let mainWin, debugWin, config;

/*
Config options:
scale: 1 is default, scales the application window
debug: false is default, whether debug statements will be logged
*/
try {
  config = JSON.parse(fs.readFileSync("./config.json"));
  log.useDebug = config.debug;
} catch (err) {
  log.err("error");
}

log.debug("config loaded");

const createWindow = () => {
  let scale = config && config.scale ? config.scale : 1;
  const width = 1200,
    height = 800;
  mainWin = new BrowserWindow({
    width: width * scale,
    height: height * scale,
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

  log.setWin(debugWin);

  debugWin.loadFile("src/debug/debug.html");

  debugWin.once("close", () => {
    log.removeWin();
  });
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
  //if (process.platform === "darwin") app.dock.hide();
  app.quit();
});

//app control
ipcMain.on("close", () => {
  mainWin.close();
});

ipcMain.on("minimize", () => {
  mainWin.minimize();
});

ipcMain.on("reload", (event, args) => {
  mainWin.webContents.reloadIgnoringCache();
});

ipcMain.on("dev-tools", (event, args) => {
  mainWin.webContents.openDevTools({ mode: "detach" });
});

ipcMain.on("open-debug", (event, args) => {
  if (!debugWin) createDebug();
});

//getters
ipcMain.handle("get-ports", (event, args) => {
  return radio.getAvailablePorts();
});

//setters
ipcMain.handle("set-port", (event, port) => {
  return new Promise((res, rej) => {
    radio
      .connect(port, 115200)
      .then((result) => {
        res(1);
      })
      .catch((err) => {
        log.err(err.toString());
        res(0);
      });
  });
});

radio.on("data", (data) => {
  log.info(data.toString());
});
