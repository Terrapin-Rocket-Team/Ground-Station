const { app, BrowserWindow, ipcMain } = require("electron");
if (require("electron-squirrel-startup")) app.quit(); //for app maker
const fs = require("fs");
const path = require("path");
const { log } = require("./debug");
const { serial } = require("./serial/SerialDevice");
const { FileTelemSource, SerialTelemSource } = require("./io/text-io");
const { FileVideoSource, SerialVideoSource } = require("./io/video-io");
const APRSTelem = require("./coders/APRSTelem");

const iconPath = path.join(__dirname, "build", "icons");
const dataPath = path.join(__dirname, "data");
const logPath = path.join(__dirname, "log");

let windows = { main: null, video: null },
  telemSources = [],
  videoSources = [],
  config,
  cacheMeta,
  closed,
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
  if (config.noGUI !== undefined || config.version !== app.getVersion())
    log.warn(
      "Older config version (likely v1.5) detected, save your settings to remove this warning"
    );
  log.useDebug = config.debug;
  log.debug("Config loaded");
} catch (err) {
  //load defaults if no config file
  config = {
    version: app.getVersion(),
    scale: 1,
    debugScale: 1,
    debug: false,
    video: false,
    //tileCache: true, //added tile cache toggling here - work in progress
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

try {
  if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);
  if (!fs.existsSync(logPath)) fs.mkdirSync(logPath);
} catch (err) {
  log.err("Failed to create output folders: " + err.message);
}

//creates the main electron window
const createMain = () => {
  const width = 1200,
    height = 800;

  const iconSuffix =
    process.platform === "win32"
      ? ".ico"
      : process.platform === "darwin"
      ? ".icns"
      : ".png";
  windows.main = new BrowserWindow({
    width: width * config.scale,
    height: height * config.scale,
    resizable: false,
    frame: false,
    autoHideMenuBar: true,
    icon: path.join(iconPath, "logo" + iconSuffix),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  windows.main.loadFile(path.join(__dirname, "src/index_new.html"));

  if (config.debug) windows.main.webContents.openDevTools({ mode: "detach" });

  windows.main.on("enter-full-screen", () => {
    log.debug("Enter main fullscreen");
    windows.main.webContents.send("fullscreen-change", {
      win: "main",
      isFullscreen: true,
    });
  });

  windows.main.on("leave-full-screen", () => {
    log.debug("Leave main fullscreen");
    windows.main.webContents.send("fullscreen-change", {
      win: "main",
      isFullscreen: false,
    });
  });

  //make sure messages are not sent to a destroyed window
  windows.main.once("close", () => {
    closed = true;
    serial.close();
    windows.main.webContents.send("close"); // unused
    if (windows.video) windows.video.close();
  });

  windows.main.once("closed", () => {
    windows.main = null;
  });

  if (!config.debug) {
    const ts1 = new SerialTelemSource("telem-avionics", {
      parser: (data) => {
        let telem = new APRSTelem(data);
        log.debug(telem);
        if (windows.main) windows.main.webContents.send("data", telem);
        if (windows.video) windows.video.webContents.send("data", telem);
      },
      createLog: true,
    });

    const ts2 = new SerialTelemSource("telem-airbrake", {
      parser: (data) => {
        let telem = new APRSTelem(data);
        log.debug(telem);
        if (windows.main) windows.main.webContents.send("data", telem);
        if (windows.video) windows.video.webContents.send("data", telem);
      },
      createLog: true,
    });

    const ts3 = new SerialTelemSource("telem-payload", {
      parser: (data) => {
        let telem = new APRSTelem(data);
        log.debug(telem);
        if (windows.main) windows.main.webContents.send("data", telem);
        if (windows.video) windows.video.webContents.send("data", telem);
      },
      createLog: true,
    });

    telemSources.push(ts1);
    telemSources.push(ts2);
    telemSources.push(ts3);
  }

  log.debug("Main window created");
};

const createVideo = () => {
  const width = 1280,
    height = 720;
  const iconSuffix =
    process.platform === "win32"
      ? ".ico"
      : process.platform === "darwin"
      ? ".icns"
      : ".png";
  windows.video = new BrowserWindow({
    width: width * config.debugScale,
    height: height * config.debugScale,
    frame: false,
    autoHideMenuBar: true,
    icon: path.join(iconPath, "logo" + iconSuffix),
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

  windows.video.loadFile(path.join(__dirname, "src/video/video.html"));

  if (config.debug) windows.video.webContents.openDevTools({ mode: "detach" });

  //reset when the window is closed
  windows.video.once("close", () => {
    windows.video.webContents.send("close"); // unused
  });

  windows.video.once("closed", () => {
    windows.video = null;
  });

  //handle fullscreen changes
  windows.video.on("enter-full-screen", () => {
    log.debug("Enter video fullscreen");
    windows.video.webContents.send("fullscreen-change", {
      win: "video",
      isFullscreen: true,
    });
  });

  windows.video.on("leave-full-screen", () => {
    log.debug("Leave video fullscreen");
    windows.video.webContents.send("fullscreen-change", {
      win: "video",
      isFullscreen: false,
    });
  });

  if (!config.debug) {
    const vs1 = new SerialVideoSource("arc-0", {
      resolution: { width: 640, height: 832 },
      framerate: 30,
      rotation: "cw",
      createLog: true,
      createDecoderLog: config.debug,
    });

    const vs2 = new SerialVideoSource("arc-1", {
      resolution: { width: 640, height: 832 },
      framerate: 30,
      rotation: "cw",
      createLog: true,
      createDecoderLog: config.debug,
    });

    videoSources.push(vs1);
    videoSources.push(vs2);
  }

  log.debug("Live stream window created");
};

//tells electron to ignore OS level display scaling
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=8192");
app.commandLine.appendSwitch("high-dpi-support", 1);
app.commandLine.appendSwitch("force-device-scale-factor", 1);

//when electron has initialized, create the appropriate window
app.whenReady().then(() => {
  createMain();
  if (config.video) createVideo();

  //open a new window if there are none when the app is opened and is still running (MacOS)
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMain();
      if (config.video) createVideo();
    }
  });
});

//quit the app if all windows are closed on MacOS
app.on("window-all-closed", () => {
  app.quit();
});

//app control
ipcMain.on("close", (event, name) => {
  windows[name].close();
});

ipcMain.on("minimize", (event, name) => {
  windows[name].minimize();
});

ipcMain.on("fullscreen", (event, name, isFullscreen) => {
  windows[name].setFullScreen(isFullscreen);
});

// TODO: remove
// ipcMain.on("open-popup", () => {
//   const popupWindow = new BrowserWindow({
//     width: 400,
//     height: 300,
//     webPreferences: {
//       contextIsolation: true,
//       nodeIntegration: false,
//     },
//   });
//   popupWindow.loadFile("popup.html");
// });

ipcMain.on("reload", (event, win, keepSettings) => {
  // TODO: can we simplify this?
  log.debug("Reloading window");
  //main and debug are basically the same window, so reloading one reloads both
  if (win === "main" || win === "debug") {
    // TODO: close serial connection, but keep pipes and the driver running
    serial.close();
    //if mainWin exists reload it
    if (windows.main) {
      windows.main.webContents.reloadIgnoringCache();
      //if in video mode send the video controls for the control panel
      if (config.video && videoControls) {
        windows.main.webContents.once("dom-ready", () => {
          windows.main.webContents.send("video-controls", videoControls);
        });
      }
    }
    serial.reload();
  }

  //handle reloading the video window separately
  if (win === "video") {
    if (windows.video) windows.video.webContents.reloadIgnoringCache();
    //if the video settings should not be kept (usually the when videoWin calls the reload), set to defaults
    if (!keepSettings) {
      videoControls = {
        layout: "two-video",
        video0: "live-video-0",
        video1: "live-video-1",
      };
      //send defaults to update mainWin
      if (videoControls)
        windows.main.webContents.send("video-controls", videoControls);
    } else {
      //otherwise, mainWin probably force reloaded videoWin, so we want to keep our old settings
      windows.video.webContents.once("dom-ready", () => {
        windows.video.webContents.send("video-controls", videoControls);
      });
    }
  }
});

ipcMain.on("dev-tools", (event, args) => {
  if (windows.main) windows.main.webContents.openDevTools({ mode: "detach" });
  if (windows.video) windows.video.webContents.openDevTools({ mode: "detach" });
});

// ipcMain.on("radio-command", (event, args) => {
//   log.debug("Sending radio command");
//   if (!commandWin) createCommand();
// });

ipcMain.on("radio-command-sent", (event, command) => {
  for (let i = 0; i < command.length; i++) {
    if (command[i] === "") command[i] = 255;
  }
  serial.writeCommand(command);
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
  serial.close();
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
  if (controls) {
    videoControls = controls;

    //if so, pass it on to videoWin, if it exists
    if (windows.video)
      windows.video.webContents.send("video-controls", videoControls);
    else log.warn("Failed setting video controls, video window missing.");
  } else log.warn("Failed setting video controls, new controls missing.");
});

//getters
ipcMain.handle("get-ports", (event, args) => {
  return serial.getAvailablePorts();
});

ipcMain.handle("get-port-status", (event, args) => {
  return serial.isConnected();
});

ipcMain.handle("get-settings", (event, args) => {
  return config;
});

ipcMain.handle("get-video", (event, args) => {
  let videoData = [];
  videoSources.forEach((stream) => {
    if (stream.hasFrame())
      //must use readFrame() to get rid of old frame
      videoData.push({ name: stream.name, data: stream.readFrame() });
    else videoData.push(null); // TODO: this seems a bit odd
  });
  return videoData;
});

//setters
ipcMain.handle("set-port", (event, portConfig) => {
  return new Promise((res, rej) => {
    serial
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
    config.version = app.getVersion();
    try {
      fs.writeFileSync("./config.json", JSON.stringify(config, null, "\t"));
      log.debug("Successfully updated settings");
    } catch (err) {
      log.err('Failed to update settings: "' + err.message + '"');
    }
  }
});

serial.on("error", (message) => {
  log.err("Serial driver error: " + message);
});

serial.on("close", (path) => {
  log.info("Serial disconnected");
  if (!closed && windows.main)
    windows.main.webContents.send("serial-close", path);
});

//testing
if (config.debug) {
  // start after 1 second to give everything time to load
  setTimeout(() => {
    //test to see whether the test csv file exists
    if (fs.existsSync("./test.csv")) {
      try {
        //set up line reader
        const ts1D = new FileTelemSource("./test.csv", {
          datarate: 1,
          parser: (data) => {
            if (!closed && windows.main) {
              //make sure we got a valid line
              let aprsMsg = APRSTelem.fromCSV(data);
              windows.main.webContents.send("data", aprsMsg);
              if (windows.video)
                windows.video.webContents.send("data", aprsMsg);
            }
          },
        });
        // const ts2D = new FileTelemSource("./test.csv", {
        //   datarate: 1,
        //   parser: (data) => {
        //     if (!closed && windows.main) {
        //       //make sure we got a valid line
        //       let aprsMsg = APRSTelem.fromCSV(data);
        //       windows.main.webContents.send("data", aprsMsg);
        //       if (windows.video)
        //         windows.video.webContents.send("data", aprsMsg);
        //     }
        //   },
        // });
        // const ts3D = new FileTelemSource("./test.csv", {
        //   datarate: 1,
        //   parser: (data) => {
        //     if (!closed && windows.main) {
        //       //make sure we got a valid line
        //       let aprsMsg = APRSTelem.fromCSV(data);
        //       windows.main.webContents.send("data", aprsMsg);
        //       if (windows.video)
        //         windows.video.webContents.send("data", aprsMsg);
        //     }
        //   },
        // });

        telemSources.push(ts1D);
        // telemSources.push(ts2D);
        // telemSources.push(ts3D);
      } catch (err) {
        log.err('Failed to read test.csv: "' + err.message + '"');
      }
    } else {
      log.warn("Could not find test.csv");
    }
    if (config.video) {
      // TODO: test to see if first video exists
      // create new video source from file
      let vs1 = new FileVideoSource("video0.av1", true, {
        resolution: { width: 640, height: 832 },
        framerate: 30,
        rotation: "cw",
        createLog: config.debug,
      });

      // TODO: test to see if second video exists
      // create new video source from file
      let vs2 = new FileVideoSource("video1.av1", false, {
        resolution: { width: 640, height: 832 },
        framerate: 30,
        rotation: "cw",
        createLog: config.debug,
      });

      // store for later
      videoSources.push(vs2);
      videoSources.push(vs1);

      // start the video
      vs1.startOutput();
      vs2.startOutput();
    }
  }, 1000);
}
