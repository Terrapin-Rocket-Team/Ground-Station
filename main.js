//TODO: launch the radio as a separate process (maybe) so saving data does not rely on the main app to work

const { app, BrowserWindow, ipcMain } = require("electron");
if (require("electron-squirrel-startup")) app.quit(); //for app maker
const fs = require("fs");
const path = require("path");
const { Blob } = require("node:buffer");
const { log } = require("./debug");
const { radio } = require("./serial/serial");

let mainWin,
  debugWin,
  config,
  cacheMeta,
  closed,
  csvCreated,
  lastHeading,
  lastSpeed,
  currentCSV;

/*
Config options:
scale: 1 is default, scales the application window
debugScale: 1 is default, scales the debug window
debug: false is default, whether debug statements will be logged
noGUI: false is default, loads only the debug window
cacheMaxSize: 1000000 (1MB) is default, max tile cache size in bytes
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
      fs.writeFileSync("./config.json", JSON.stringify(config, null, "\t"));
      log.info("Config file successfully created");
    }
  } catch (err) {
    log.err('Failed to create config file: "' + err.message + '"');
  }
}

try {
  //load cache metadata
  cacheMeta = JSON.parse(fs.readFileSync("./cachedtiles/metadata.json"));
  log.debug("Cache metadata loaded");
} catch (err) {
  cacheMeta = {
    tiles: {},
    fileList: [],
    runningSize: 0,
  };
  log.warn(
    'Failed to load cache metadata file, using defaults: "' + err.message + '"'
  );
  try {
    if (!fs.existsSync("./cachedtiles")) fs.mkdirSync("./cachedtiles");
    if (!fs.existsSync("./cachedtiles/metadata.json")) {
      fs.writeFileSync(
        "./cachedtiles/metadata.json",
        JSON.stringify(cacheMeta, null, "\t")
      );
      log.info("Metadata file successfully created");
    }
  } catch (err) {
    log.err('Failed to create metadata file: "' + err.message + '"');
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
  mainWin.once("close", () => {
    closed = true;
    radio.close();
    debugWin.close();
  });
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

ipcMain.on("cache-tile", (event, tile, tilePathNums) => {
  try {
    tilePath = [
      String(tilePathNums[0]),
      String(tilePathNums[1]),
      String(tilePathNums[2]),
    ];
    while (cacheMeta.runningSize + tile.byteLength > config.cacheMaxSize) {
      // shift off the fileList and delete file and containing folders if necessary
      let oldTile = cacheMeta.fileList.shift();
      let oldFolders = oldTile.split(path.sep);
      let fileSize = fs.lstatSync(
        path.join("cachedtiles", oldTile + ".png")
      ).size;

      //remove the file
      fs.rmSync(path.join("cachedtiles", oldTile + ".png"));

      cacheMeta.tiles[oldFolders[0]][oldFolders[1]].splice(
        cacheMeta.tiles[oldFolders[0]][oldFolders[1]].indexOf(oldFolders[2]),
        1
      );

      //remove the folder one level above the file if it is empty
      if (
        fs.readdirSync(path.join("cachedtiles", oldFolders[0], oldFolders[1]))
          .length === 0
      ) {
        fs.rmdirSync(path.join("cachedtiles", oldFolders[0], oldFolders[1]));
        delete cacheMeta.tiles[oldFolders[0]][oldFolders[1]];
      }

      //remove the folder two levels above the file if it is empty
      if (
        fs.readdirSync(path.join("cachedtiles", oldFolders[0])).length === 0
      ) {
        fs.rmdirSync(path.join("cachedtiles", oldFolders[0]));
        delete cacheMeta.tiles[oldFolders[0]];
      }

      cacheMeta.runningSize -= fileSize;
    }

    let folderPath = path.join("cachedtiles", tilePath[0], tilePath[1]);

    //create folders if necessary
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, {
        recursive: true,
      });
    }

    //see what folders/files already exist
    let hasZoom = cacheMeta.tiles[tilePath[0]];
    let hasX = hasZoom ? cacheMeta.tiles[tilePath[0]][tilePath[1]] : 0;
    let hasY = hasX
      ? cacheMeta.tiles[tilePath[0]][tilePath[1]].includes(tilePath[2])
      : 0;

    //add the appropriate amount of stucture to the metadata
    if (!hasZoom) {
      cacheMeta.tiles[tilePath[0]] = {
        [tilePath[1]]: [tilePath[2]],
      };
    } else if (!hasX) {
      cacheMeta.tiles[tilePath[0]][tilePath[1]] = [tilePath[2]];
    } else if (!hasY) {
      cacheMeta.tiles[tilePath[0]][tilePath[1]].push(tilePath[2]);
    }

    if (hasY) {
      //if the file already exists, check if it is a different size
      let fileSize = fs.lstatSync(
        path.join(folderPath, tilePath[2] + ".png")
      ).size;
      if (fileSize != tile.byteLength) {
        cacheMeta.runningSize -= fileSize;
        cacheMeta.runningSize += tile.byteLength;
        fs.writeFileSync(
          path.join(folderPath, tilePath[2] + ".png"),
          Buffer.from(tile)
        );
      }
    } else {
      //add the file
      cacheMeta.runningSize += tile.byteLength;
      cacheMeta.fileList.push(path.join(tilePath[0], tilePath[1], tilePath[2]));
      fs.writeFileSync(
        path.join(folderPath, tilePath[2] + ".png"),
        Buffer.from(tile)
      );
    }

    //write metadata
    fs.writeFileSync(
      "./cachedtiles/metadata.json",
      JSON.stringify(cacheMeta, null, "\t")
    );
  } catch (err) {
    log.err('Error caching tile: "' + err.message + '"');
  }
});

ipcMain.handle("get-tiles", () => {
  return cacheMeta.tiles;
});

ipcMain.handle("get-tile", (event, coords) => {
  try {
    return fs.readFileSync(
      path.join(
        "cachedtiles",
        String(coords[0]),
        String(coords[1]),
        String(coords[2]) + ".png"
      )
    ).buffer;
  } catch (err) {
    log.err('Error getting tile: "' + err.message + '"');
    return null;
  }
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
    if (!csvCreated) {
      if (!fs.existsSync("data")) fs.mkdirSync("data");
      currentCSV = new Date().toISOString().replace(/:/g, "-") + ".csv";
      fs.writeFileSync(path.join("data", currentCSV), "");
    }
    fs.appendFileSync(path.join("data", currentCSV), data.toCSV(csvCreated));
    if (!csvCreated) csvCreated = true;
    //write data from serial to be used in testing if debug is on
    if (config.debug) fs.writeFileSync("test.json", JSON.stringify(data));
  } catch (err) {
    log.err('Error writing data: "' + err.message + '"');
  }
});

radio.on("error", (message) => {
  log.err("Error parsing APRS message: " + message);
});

radio.on("close", () => {
  log.info("Serial disconnected");
  if (!closed) mainWin.webContents.send("radio-close");
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
