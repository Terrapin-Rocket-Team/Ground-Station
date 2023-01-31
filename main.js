//TODO: launch the radio as a separate process (maybe) so saving data does not rely on the main app to work

const { app, BrowserWindow, ipcMain } = require("electron");
if (require("electron-squirrel-startup")) app.quit(); //for app maker
const fs = require("fs");
const path = require("path");
const { log } = require("./debug");
const { radio } = require("./serial/serial");

let mainWin, debugWin, config, closed, csvCreated, lastHeading, lastSpeed;

/*
Config options:
scale: 1 is default, scales the application window
debugScale: 1 is default, scales the debug window
debug: false is default, whether debug statements will be logged
noGUI: false is default, loads only the debug window
*/
try {
  //load config
  config = JSON.parse(fs.readFileSync("./config.json"));
  log.useDebug = config.debug;
  log.debug("Config loaded");
} catch (err) {
  config = {
    scale: 1,
    debugScale: 1,
    debug: false,
    noGUI: false,
  };
  log.warn('Failed to load config file, using defaults: "' + err.message + '"');
  try {
    if (!fs.existsSync("./config.json")) {
      log.info("Config file successfully created");
      fs.writeFileSync("./config.json", JSON.stringify(config, null, "\t"));
    }
  } catch (err) {
    log.err('Failed to create config file: "' + err.message + '"');
  }
}

//creates the main electron window
const createWindow = () => {
  const width = 1200,
    height = 800;

  const iconSuffix =
    process.platform === "win32"
      ? ".ico"
      : process.platform === "darwin"
      ? ".icns"
      : ".png";
  mainWin = new BrowserWindow({
    width: width * config.scale,
    height: height * config.scale,
    resizable: false,
    frame: false,
    autoHideMenuBar: true,
    icon: "assets/icon" + iconSuffix,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWin.loadFile("src/index.html");

  if (config.debug) mainWin.webContents.openDevTools({ mode: "detach" });
  log.debug("Main window created");

  //for some reason the program does not end quickly enough after the main window is destroyed to prevent errors when debug is used
  //this condition should stop the messages being sent to the destroyed window
  if (config.debug) {
    mainWin.once("close", () => {
      closed = true;
    });
  }
};

//creates the debug electron window
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

  //send the debug window all previous logs once it is ready
  debugWin.webContents.once("dom-ready", () => {
    try {
      if (fs.existsSync("debug.log"))
        debugWin.webContents.send(
          "previous-logs",
          fs.readFileSync("debug.log").toString()
        );
    } catch (err) {
      log.err('Could not load previous logs: "' + err.message + '"');
    }
  });

  //reset when the window is closed
  debugWin.once("close", () => {
    log.removeWin();
    debugWin = null;
  });
  log.debug("Debug window created");
};

//when electron has initialized, create the appropriate window
app.whenReady().then(() => {
  if (!config.noGUI) {
    createWindow();
  } else {
    createDebug();
  }

  //open a new window if there are none when the app is opened and is still running (MacOS)
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (!config.noGUI) {
        createWindow();
      } else {
        createDebug();
      }
    }
  });

  //I don't think this line is necessary
  //if (process.platform === "win32") app.setAppUserModelId(app.getName());
});

//quit the app if all windows are closed on MacOS
app.on("window-all-closed", () => {
  app.quit();
});

//app control
ipcMain.on("close", () => {
  log.debug("Closing main window");
  mainWin.close();
});

ipcMain.on("minimize", () => {
  mainWin.minimize();
});

ipcMain.on("reload", (event, args) => {
  log.debug("Reloading main window");
  radio.close();
  mainWin.webContents.reloadIgnoringCache();
});

ipcMain.on("dev-tools", (event, args) => {
  mainWin.webContents.openDevTools({ mode: "detach" });
});

ipcMain.on("open-debug", (event, args) => {
  log.debug("Debug window opened from main");
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
        log.info("Successfully connected to port " + port);
        res(1);
      })
      .catch((err) => {
        log.err(
          "Failed to connect to port " + port + ': "' + err.message + '"'
        );
        res(0);
      });
  });
});

//serial communication
radio.on("data", (data) => {
  if (!data.getHeading() && !data.getSpeed()) {
    data.body.heading = lastHeading;
    data.body.speed = lastSpeed;
  } else {
    lastHeading = data.body.heading;
    lastSpeed = data.body.speed;
  }
  log.info(data.toString());
  mainWin.webContents.send("data", data);
  try {
    if (!csvCreated) fs.writeFileSync("data.csv", "");
    fs.appendFileSync("data.csv", data.toCSV(csvCreated));
    if (!csvCreated) csvCreated = true;
    //write data from serial to be used in testing if debug is on
    if (config.debug) fs.writeFileSync("test.json", JSON.stringify(data));
  } catch (err) {
    log.err("Error writing data: " + err.message);
  }
});

radio.on("error", (message) => {
  log.err("Error parsing APRS message: " + message);
});

radio.on("close", () => {
  log.info("Serial disconnected");
  mainWin.webContents.send("radio-close");
});

//testing
if (config.debug) {
  setInterval(() => {
    if (!closed)
      mainWin.webContents.send(
        "data",
        JSON.parse(fs.readFileSync("test.json"))
      );
  }, 1000);
}
