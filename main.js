//TODO: launch the radio and data logging as a separate process (maybe) so saving data does not rely on the main app to work

const { app, BrowserWindow, ipcMain } = require("electron");
if (require("electron-squirrel-startup")) app.quit(); //for app maker
const fs = require("fs");
const readline = require("readline");
const path = require("path");
const { log } = require("./debug");
const { radio } = require("./serial/serialPipe");
const { APRSMessage } = require("./serial/APRS");
const { FileStreamSource } = require("./video/video-source");

let mainWin,
  debugWin,
  videoWin,
  videoStreams = [],
  config,
  commandWin,
  cacheMeta,
  closed,
  csvCreated,
  lastHeading,
  lastSpeed,
  currentCSV,
  videoControls;

/*
Config options:
scale: 1 is default, scales the application window
debugScale: 1 is default, scales the debug window
debug: false is default, whether debug statements will be logged
noGUI: false is default, loads only the debug window
video: false is default, whether the ground station launches with video streaming enabled
tileCache: true by default, whether tiles will be cached - work in progress
cacheMaxSize: 100000000 (100MB) is default, max tile cache size in bytes
baudRate: 115200 is default, baudrate to use with the connected serial port
*/
try {
  //load config
  config = JSON.parse(fs.readFileSync("./config.json"));
  if (config.video === undefined)
    log.warn(
      "Older config version detected, save your settings to remove this warning"
    );
  log.useDebug = config.debug;
  log.debug("Config loaded");
} catch (err) {
  //load defaults if no config file
  config = {
    scale: 1,
    debugScale: 1,
    debug: false,
    noGUI: false,
    video: false,
    //tileCache: true, //added tile toggling here - work in progress
    cacheMaxSize: 100000000,
    baudRate: 115200,
  };
  //create new config file
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
  cacheMeta = JSON.parse(
    fs.readFileSync(path.join(__dirname, "src/cachedtiles/metadata.json"))
  );
  log.debug("Cache metadata loaded");
} catch (err) {
  //load defaults if no metadata file
  cacheMeta = {
    tiles: {},
    fileList: [],
    runningSize: 0,
  };
  log.warn(
    'Failed to load cache metadata file, using defaults: "' + err.message + '"'
  );
  //create new metadata file
  try {
    if (!fs.existsSync(path.join(__dirname, "src/cachedtiles")))
      fs.mkdirSync(path.join(__dirname, "src/cachedtiles"));
    if (!fs.existsSync(path.join(__dirname, "src/cachedtiles/metadata.json"))) {
      fs.writeFileSync(
        path.join(__dirname, "src/cachedtiles/metadata.json"),
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
    icon: "assets/logo" + iconSuffix,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWin.loadFile(path.join(__dirname, "src/index.html"));

  if (config.debug) mainWin.webContents.openDevTools({ mode: "detach" });
  log.debug("Main window created");

  //make sure messages are not sent to a destroyed window
  mainWin.once("close", () => {
    if (!config.noGUI) {
      closed = true;
      radio.close();
    }
    mainWin.webContents.send("close"); // unused
    if (!config.noGUI) {
      if (debugWin) debugWin.close();
      if (videoWin) videoWin.close();
    }
  });

  mainWin.once("closed", () => {
    mainWin = null;
  });
};

//creates the debug electron window
const createDebug = () => {
  const width = 600,
    height = 400;
  const iconSuffix =
    process.platform === "win32"
      ? ".ico"
      : process.platform === "darwin"
      ? ".icns"
      : ".png";
  debugWin = new BrowserWindow({
    width: width * config.debugScale,
    height: height * config.debugScale,
    resizable: false,
    autoHideMenuBar: true,
    icon: "assets/logo" + iconSuffix,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  log.setWin(debugWin);

  debugWin.loadFile(path.join(__dirname, "src/debug/debug.html"));

  if (config.debug) debugWin.webContents.openDevTools({ mode: "detach" });

  //send the debug window all previous logs once it is ready
  debugWin.webContents.once("dom-ready", () => {
    try {
      if (fs.existsSync("./debug.log"))
        debugWin.webContents.send(
          "previous-logs",
          fs.readFileSync("./debug.log").toString()
        );
    } catch (err) {
      log.err('Could not load previous logs: "' + err.message + '"');
    }
  });

  //reset when the window is closed
  debugWin.once("close", () => {
    if (config.noGUI) {
      closed = true;
      radio.close();
    }
    debugWin.webContents.send("close"); // unused
    log.removeWin();
    if (config.noGUI) {
      if (mainWin) mainWin.close();
      if (videoWin) videoWin.close();
      if (commandWin) commandWin.close();
    }
  });

  debugWin.once("closed", () => {
    debugWin = null;
  });
  log.debug("Debug window created");
};

//creates the command electron window
const createCommand = () => {
  const width = 600,
    height = 400;
  const iconSuffix =
    process.platform === "win32"
      ? ".ico"
      : process.platform === "darwin"
      ? ".icns"
      : ".png";

  commandWin = new BrowserWindow({
    width: width,
    height: height,
    resizable: false,
    autoHideMenuBar: true,
    icon: "assets/logo" + iconSuffix,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
  });

  commandWin.loadFile('serial/popup.html');

  log.debug("Command window created");

  commandWin.on('closed', () => {
    commandWin = null;
  });
};

//creates the debug electron window
const createVideo = () => {
  const width = 1280,
    height = 720;
  const iconSuffix =
    process.platform === "win32"
      ? ".ico"
      : process.platform === "darwin"
      ? ".icns"
      : ".png";
  videoWin = new BrowserWindow({
    width: width * config.debugScale,
    height: height * config.debugScale,
    frame: false,
    autoHideMenuBar: true,
    icon: "assets/logo" + iconSuffix,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  //default video window state
  videoControls = {
    layout: "two-video",
    video0: "none-0",
    video1: "none-1",
  };

  videoWin.loadFile(path.join(__dirname, "src/video/video.html"));

  if (config.debug) videoWin.webContents.openDevTools({ mode: "detach" });

  //reset when the window is closed
  videoWin.once("close", () => {
    videoWin.webContents.send("close"); // unused
  });

  videoWin.once("closed", () => {
    videoWin = null;
  });

  //handle fullscreen changes
  videoWin.on("enter-full-screen", () => {
    log.debug("Enter video fullscreen");
    videoWin.webContents.send("fullscreen-change", {
      win: "video",
      isFullscreen: true,
    });
  });

  videoWin.on("leave-full-screen", () => {
    log.debug("Leave video fullscreen");
    videoWin.webContents.send("fullscreen-change", {
      win: "video",
      isFullscreen: false,
    });
  });
  log.debug("Video streaming window created");
};

//tells electron to ignore OS level display scaling
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');
app.commandLine.appendSwitch("high-dpi-support", 1);
app.commandLine.appendSwitch("force-device-scale-factor", 1);

//when electron has initialized, create the appropriate window
app.whenReady().then(() => {
  if (!config.noGUI) {
    createWindow();
  } else {
    createDebug();
  }

  if (config.video) createVideo();
  //open a new window if there are none when the app is opened and is still running (MacOS)
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (!config.noGUI) {
        createWindow();
      } else {
        createDebug();
      }
      if (config.video) createVideo();
    }
  });
});

//quit the app if all windows are closed on MacOS
app.on("window-all-closed", () => {
  app.quit();
});

//app control
ipcMain.on("close", (event, win) => {
  if (win === "main") {
    log.debug("Closing main window");
    mainWin.close();
  }
  if (win === "video") {
    log.debug("Closing video window");
    videoWin.close();
  }
});

ipcMain.on("minimize", (event, win) => {
  if (win === "main") {
    mainWin.minimize();
  }
  if (win === "video") {
    videoWin.minimize();
  }
});

ipcMain.on('open-popup', () => {
  const popupWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  popupWindow.loadFile('popup.html');
});

ipcMain.on("fullscreen", (event, win, isFullscreen) => {
  if (win === "main") {
    mainWin.setFullScreen(isFullscreen);
  }
  if (win === "video") {
    videoWin.setFullScreen(isFullscreen);
  }
});

ipcMain.on("reload", (event, win, keepSettings) => {
  log.debug("Reloading window");
  //main and debug are basically the same window, so reloading one reloads both
  if (win === "main" || win === "debug") {
    radio.close();
    //if mainWin exists reload it
    if (mainWin) {
      mainWin.webContents.reloadIgnoringCache();
      //if in video mode send the video controls for the control panel
      if (config.video && videoControls) {
        mainWin.webContents.once("dom-ready", () => {
          mainWin.webContents.send("video-controls", videoControls);
        });
      }
    }
    //if debugWin exists reload it
    if (debugWin) {
      debugWin.webContents.reloadIgnoringCache();
      //send old logs
      debugWin.webContents.once("dom-ready", () => {
        try {
          if (fs.existsSync("./debug.log"))
            debugWin.webContents.send(
              "previous-logs",
              fs.readFileSync("./debug.log").toString()
            );
        } catch (err) {
          log.err('Could not load previous logs: "' + err.message + '"');
        }
      });
    }
  }

  //if commandWin exists close it
  if (commandWin) commandWin.close();

  //handle reloading the video window separately
  if (win === "video") {
    if (videoWin) videoWin.webContents.reloadIgnoringCache();
    //if the video settings should not be kept (usually the when videoWin calls the reload), set to defaults
    if (!keepSettings) {
      videoControls = {
        layout: "two-video",
        video0: "live-video-0",
        video1: "live-video-1",
      };
      //send defaults to update mainWin
      if (videoControls)
        mainWin.webContents.send("video-controls", videoControls);
    } else {
      //otherwise, mainWin probably force reloaded videoWin, so we want to keep our old settings
      videoWin.webContents.once("dom-ready", () => {
        videoWin.webContents.send("video-controls", videoControls);
      });
    }
  }
});

ipcMain.on("dev-tools", (event, args) => {
  if (mainWin) mainWin.webContents.openDevTools({ mode: "detach" });
  if (debugWin) debugWin.webContents.openDevTools({ mode: "detach" });
  if (videoWin) videoWin.webContents.openDevTools({ mode: "detach" });
});

ipcMain.on("open-gui", (event, args) => {
  log.debug("Main window opened from debug");
  if (!mainWin) createWindow();
  if (config.video && !videoWin) createVideo();
});

ipcMain.on("open-debug", (event, args) => {
  log.debug("Debug window opened from main");
  if (!debugWin) createDebug();
});

ipcMain.on("radio-command", (event, args) => {
  log.debug("Sending radio command");
  if (!commandWin) createCommand();
});

ipcMain.on("radio-command-sent", (event, command) => {
  for (let i = 0; i < command.length; i++) {
    if (command[i] === "") command[i] = -1;
  }
  radio.writeCommand(command);
  if (commandWin) commandWin.close();
});

ipcMain.on("cache-tile", (event, tile, tilePathNums) => {
  try {
    tilePath = [tilePathNums[0], tilePathNums[1], tilePathNums[2]];
    while (cacheMeta.runningSize + tile.byteLength > config.cacheMaxSize) {
      // shift off the fileList and delete file and containing folders if necessary
      let oldTile = cacheMeta.fileList.shift();
      let oldFolders = oldTile.split(path.sep);
      let fileSize = fs.lstatSync(
        path.join(__dirname, "src", "cachedtiles", oldTile + ".png")
      ).size;

      //remove the file
      fs.rmSync(path.join(__dirname, "src", "cachedtiles", oldTile + ".png"));

      cacheMeta.tiles[oldFolders[0]][oldFolders[1]].splice(
        cacheMeta.tiles[oldFolders[0]][oldFolders[1]].indexOf(oldFolders[2]),
        1
      );

      //remove the folder one level above the file if it is empty
      if (
        fs.readdirSync(
          path.join(
            __dirname,
            "src",
            "cachedtiles",
            oldFolders[0],
            oldFolders[1]
          )
        ).length === 0
      ) {
        fs.rmdirSync(
          path.join(
            __dirname,
            "src",
            "cachedtiles",
            oldFolders[0],
            oldFolders[1]
          )
        );
        delete cacheMeta.tiles[oldFolders[0]][oldFolders[1]];
      }

      //remove the folder two levels above the file if it is empty
      if (
        fs.readdirSync(
          path.join(__dirname, "src", "cachedtiles", oldFolders[0])
        ).length === 0
      ) {
        fs.rmdirSync(path.join(__dirname, "src", "cachedtiles", oldFolders[0]));
        delete cacheMeta.tiles[oldFolders[0]];
      }

      cacheMeta.runningSize -= fileSize;
    }

    let folderPath = path.join(
      __dirname,
      "src",
      "cachedtiles",
      tilePath[0],
      tilePath[1]
    );

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
      path.join(__dirname, "src/cachedtiles/metadata.json"),
      JSON.stringify(cacheMeta, null, "\t")
    );
  } catch (err) {
    log.err('Error caching tile: "' + err.message + '"');
  }
});

ipcMain.handle("get-tiles", () => {
  return cacheMeta.tiles;
});

ipcMain.on("close-port", (event, args) => {
  radio.close();
});

ipcMain.on("clear-tile-cache", (event, args) => {
  try {
    if (fs.existsSync(path.join(__dirname, "src", "cachedtiles"))) {
      cacheMeta = {
        tiles: {},
        fileList: [],
        runningSize: 0,
      };
      fs.rmSync(path.join(__dirname, "src", "cachedtiles"), {
        recursive: true,
        force: true,
      });
      log.debug("Tile cache successfully cleared");
    }
  } catch (err) {
    log.err('Error clearing tile cache: "' + err.message + '"');
  }
});

ipcMain.on("video-controls", (event, controls) => {
  log.debug("Updating video controls");
  //make sure we actually got a controls object
  if (controls) videoControls = controls;
  else log.warn("Failed setting video controls, new controls missing.");
  //if so, pass it on to videoWin, if it exists
  if (controls && videoWin)
    videoWin.webContents.send("video-controls", videoControls);
  else log.warn("Failed setting video controls, video window missing.");
});

//getters
ipcMain.handle("get-ports", (event, args) => {
  return radio.getAvailablePorts();
});

ipcMain.handle("get-port-status", (event, args) => {
  return radio.isConnected();
});

ipcMain.handle("get-settings", (event, args) => {
  return config;
});

ipcMain.handle("get-video", (event, args) => {
  let videoData = [];
  videoStreams.forEach((stream) => {
    if (stream.hasFrame())
      //must use readFrame() to get rid of old frame
      videoData.push({ name: stream.name, data: stream.readFrame() });
    else videoData.push(null);
  });
  return videoData;
});

//setters
ipcMain.handle("set-port", (event, portConfig) => {
  return new Promise((res, rej) => {
    radio
      .connect(portConfig.path, config.baudRate)
      .then((result) => {
        log.info("Successfully connected to port " + portConfig.path);
        res(1);
      })
      .catch((err) => {
        log.err(
          "Failed to connect to port " +
            portConfig.path +
            ': "' +
            err.message +
            '"'
        );
        res(0);
      });
  });
});

ipcMain.on("update-settings", (event, settings) => {
  if (settings) {
    config = settings;
    try {
      fs.writeFileSync("./config.json", JSON.stringify(config, null, "\t"));
      log.debug("Successfully updated settings");
    } catch (err) {
      log.err('Failed to update settings: "' + err.message + '"');
    }
  }
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
  if (mainWin) mainWin.webContents.send("data", data);
  if (videoWin) videoWin.webContents.send("data", data);
  try {
    if (!csvCreated) {
      if (!fs.existsSync("./data")) fs.mkdirSync("./data");
      currentCSV = new Date().toISOString().replace(/:/g, "-") + ".csv";
      fs.writeFileSync(path.join("./data", currentCSV), "");
    }
    fs.appendFileSync(path.join("./data", currentCSV), data.toCSV(csvCreated));
    if (!csvCreated) csvCreated = true;
  } catch (err) {
    log.err('Error writing data: "' + err.message + '"');
  }
});

radio.on("video1chunk", () => {
  if (videoStreams[0]) videoStreams[0].i._read(1250);
});

radio.on("video2chunk", () => {
  if (videoStreams[1]) videoStreams[1].i._read(1250)
});

radio.on("error", (message) => {
  log.err("Error parsing APRS message: " + message);
});

radio.on("close", (path) => {
  log.info("Serial disconnected");
  if (!closed && mainWin) mainWin.webContents.send("radio-close", path);
});

//testing
if (config.debug) {
  // start after 1 second to give everything time to load
  setTimeout(() => {
    //test to see whether the test csv file exists
    if (fs.existsSync("./test.csv")) {
      try {
        //set up line reader
        const testCSV = fs.createReadStream("./test.csv");
        const rl = readline.createInterface({
          input: testCSV,
          crlfDelay: Infinity,
        });
        const lines = [];
        let isPaused = false;
        let firstLine = true;

        rl.on("line", (line) => {
          if (!firstLine) lines.push(line);
          if (firstLine) firstLine = false;
          //stop reading lines so we don't fill up memory
          if (lines.length > 100) {
            rl.pause();
            isPaused = true;
          }
        });

        rl.on("close", () => {
          log.debug("Finished reading test.csv");
        });

        setInterval(() => {
          if (!closed && mainWin) {
            //get the next message
            let line = lines.shift();
            //make sure we got a valid line
            if (line) {
              let aprsMsg = APRSMessage.fromCSV(line);
              mainWin.webContents.send("data", aprsMsg);
              if (videoWin) videoWin.webContents.send("data", aprsMsg);
            }
            //resume if we have emptied lots of lines
            if (lines.length < 50 && isPaused) {
              rl.resume();
              isPaused = false;
            }
          }
        }, 1000);
      } catch (err) {
        log.err('Failed to read test.csv: "' + err.message + '"');
      }
    } else {
      log.warn("Could not find test.csv");
    }
    if (config.video) {
      //test to see if first video exists
      //create new video source from file
      let vs1 = new FileStreamSource("\\\\.\\pipe\\ffmpegVideoOne", true, {
        resolution: { width: 640, height: 832 },
        framerate: 30,
        rotation: "cw",
        createLog: config.debug,
      });
      //store for later
      videoStreams.push(vs1);
      //start the video
      vs1.startOutput();
      //test to see if second video exists
      //create new video source from file
      let vs2 = new FileStreamSource("\\\\.\\pipe\\ffmpegVideoTwo", false, {
        resolution: { width: 640, height: 832 },
        framerate: 30,
        rotation: "cw",
        createLog: config.debug,
      });
      //store for later
      videoStreams.push(vs2);
      //start the video
      vs2.startOutput();
      
    }
  }, 1000);
}
