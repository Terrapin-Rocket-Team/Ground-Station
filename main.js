/*
TODO: 
- make sure the port is not already open for serial port
*/
const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { log } = require("./debug");
const { radio } = require("./serial/serial");

let mainWin, debugWin, config;

/*
Config options:
scale: 1 is default, scales the application window
debugScale: 1 is default, scales the debug window
debug: false is default, whether debug statements will be logged
noGUI: false is default, loads only the debug window
*/
try {
  config = JSON.parse(fs.readFileSync("./config.json"));
  log.useDebug = config.debug;
} catch (err) {
  config = {
    scale: 1,
    debugScale: 1,
    useDebug: false,
    noGUI: false,
  };
  log.err("error");
}

log.debug("config loaded");

const createWindow = () => {
  const width = 1200,
    height = 800;
  mainWin = new BrowserWindow({
    width: 1200, //width * config.scale,
    height: height * config.scale,
    resizable: false,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWin.loadFile("src/index.html");

  /*if (config.debug) */ mainWin.webContents.openDevTools({ mode: "detach" });
};

const createDebug = () => {
  const width = 600,
    height = 400;
  debugWin = new BrowserWindow({
    width: width * config.debugScale,
    height: height * config.debugScale,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  log.setWin(debugWin);

  debugWin.loadFile("src/debug/debug.html");

  if (config.debug) debugWin.webContents.openDevTools({ mode: "detach" });

  debugWin.webContents.once("dom-ready", () => {
    try {
      if (fs.existsSync("debug.log"))
        debugWin.webContents.send(
          "previous-logs",
          fs.readFileSync("debug.log").toString()
        );
    } catch (err) {
      log.err(err);
    }
  });

  debugWin.once("close", () => {
    log.removeWin();
    debugWin = null;
  });
};

app.whenReady().then(() => {
  if (!config.noGUI) {
    createWindow();
  } else {
    createDebug();
  }

  //check if this line should be updated like above
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

setInterval(() => {
  mainWin.webContents.send("data", JSON.parse(fs.readFileSync("test.json")));
}, 1000);
