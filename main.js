const { app, BrowserWindow, ipcMain } = require("electron");
if (require("electron-squirrel-startup")) app.quit(); //for app maker
const fs = require("fs");
const path = require("path");
const { log } = require("./debug");
const { serial } = require("./serial/SerialDevice");
const {
  FileTelemSource,
  SerialTelemSource,
  SerialCommandSink,
  FileCommandSink,
} = require("./io/text-io");
const { FileVideoSource, SerialVideoSource } = require("./io/video-io");
const APRSTelem = require("./coders/APRSTelem");
const Metrics = require("./coders/Metrics");
const APRSCmd = require("./coders/APRSCmd");

const iconPath = path.join(__dirname, "build", "icons");
const dataPath = "./data";
const logPath = "./log";

let windows = { main: null, video: null },
  telemSources = [],
  videoSources = [],
  commandSinks = [],
  config,
  cmdList,
  stateflags,
  cacheMeta,
  closed,
  videoControls = {
    layout: "two-video",
    video0: "none-0",
    video1: "none-1",
  };

/*
See default-config.json for default settings
*/
try {
  // load config
  config = JSON.parse(fs.readFileSync("./config.json"));
  // temporary check for property values being defined
  // will eventually just check config version
  if (
    config.debugScale !== undefined ||
    config.noGUI !== undefined ||
    config.version !== app.getVersion()
  ) {
    log.warn(
      "Older config version (likely v1.5) detected, save your settings to remove this warning"
    );
    throw new Error("old config version"); // throw an error to get the default config to load
  }
  // setup logger
  log.useDebug = config.debug.value;
  serial.useDebug = config.driverDebug.value;
  if (config.dataDebug.value && config.driverDebug.value)
    log.warn(
      'Configuration warning: "Debug Data Input" and "Serial Driver Debug" have both been turned on. These settings can create conflicting streams of data so it is recommended to disable one of them.'
    );
  log.debug("Config loaded");
} catch (err) {
  // load defaults if no config file
  log.warn("Failed to load config file, using defaults: " + err.message);
  try {
    config = JSON.parse(
      fs.readFileSync(path.join(__dirname, "default-config.json"))
    );
    if (config.version !== app.getVersion()) {
      log.warn(
        "Developer warning: default config version does not match app version! You can probably safely ignore this error. Updating default config version."
      );
      // update config file version if app version has changed
      config.version = app.getVersion();
      fs.writeFileSync(
        path.join(__dirname, "default-config.json"),
        JSON.stringify(config, null, "\t")
      );
    }
    // create new config file
    try {
      if (!fs.existsSync("./config.json")) {
        fs.writeFileSync("./config.json", JSON.stringify(config, null, "\t"));
        log.info("Config file successfully created");
      }
    } catch (err) {
      log.err("Failed to create config file: " + err.message);
    }
  } catch (err) {
    log.err("Failed to load default config: " + err.message);
  }
}

// need to setup after loading config
serial.setupDriver();

if (!config.tileCache.value) {
  // if the cache is disabled, remove cached tiles on startup
  try {
    // check if the metadata file exists
    if (fs.existsSync(path.join(__dirname, "src", "cachedtiles"))) {
      // reset the metadata and remove the metadata file
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
}

try {
  // load command list
  cmdList = JSON.parse(fs.readFileSync("./commands.json"));

  APRSCmd.createCommandList(cmdList);

  log.debug("Commands loaded");
} catch (err) {
  log.warn(
    "Failed to load commands file, some features will not be available: " +
      err.message
  );
  cmdList = [];
}

try {
  // load stateflags
  stateflags = JSON.parse(fs.readFileSync("./stateflags.json"));

  APRSTelem.createStateflagList(stateflags);

  log.debug("Stateflags loaded");
} catch (err) {
  log.warn(
    "Failed to load stateflags file, some features will not be available: " +
      err.message
  );
  stateflags = [];
}

try {
  // load cache metadata
  cacheMeta = JSON.parse(
    fs.readFileSync(path.join(__dirname, "src", "cachedtiles", "metadata.json"))
  );
  log.debug("Cache metadata loaded");
} catch (err) {
  // load defaults if no metadata file
  cacheMeta = {
    tiles: {},
    fileList: [],
    runningSize: 0,
  };
  log.warn(
    'Failed to load cache metadata file, using defaults: "' + err.message + '"'
  );
  // create new metadata file
  try {
    // make the folder if it doesn't exist
    if (!fs.existsSync(path.join(__dirname, "src", "cachedtiles")))
      fs.mkdirSync(path.join(__dirname, "src", "cachedtiles"));
    // write the file if it doesn't exist
    if (
      !fs.existsSync(
        path.join(__dirname, "src", "cachedtiles", "metadata.json")
      )
    ) {
      fs.writeFileSync(
        path.join(__dirname, "src", "cachedtiles", "metadata.json"),
        JSON.stringify(cacheMeta, null, "\t")
      );
      log.info("Metadata file successfully created");
    }
  } catch (err) {
    log.err('Failed to create metadata file: "' + err.message + '"');
  }
}

try {
  // create output folders for log files and data files
  if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);
  if (!fs.existsSync(logPath)) fs.mkdirSync(logPath);
} catch (err) {
  log.err("Failed to create output folders: " + err.message);
}

const loadStreams = () => {
  // reset everything
  telemSources = [];
  videoSources = [];
  commandSinks = [];
  serial.clearStreams();

  // load streams from config
  config.streams.forEach((stream) => {
    if (stream.enabled) {
      if (stream.type === "APRSTelem") {
        telemSources.push(
          new SerialTelemSource(`${stream.name}-${stream.id}`, {
            parser: (data) => {
              let telem = new APRSTelem(
                data,
                stream.name,
                stream.settings.stateflags
              );
              log.info(telem);
              if (windows.main) windows.main.webContents.send("data", telem);
              if (windows.video) windows.video.webContents.send("data", telem);
            },
            createLog: true,
          })
        );
      }
      if (stream.type === "APRSCmd") {
        commandSinks.push(
          new SerialCommandSink(`${stream.name}-${stream.id}`, {
            createLog: true,
          })
        );
      }
      if (stream.type === "Metrics") {
        telemSources.push(
          new SerialTelemSource(`${stream.name}-${stream.id}`, {
            parser: (data) => {
              let telem = new Metrics(data, true);
              log.info(telem);
              if (windows.main) windows.main.webContents.send("metrics", telem);
              if (windows.video)
                windows.video.webContents.send("metrics", telem);
            },
            isMetrics: true,
            createLog: true,
          })
        );
      }
      if (stream.type === "video" && config.video.value) {
        videoSources.push(
          new SerialVideoSource(`${stream.name}-${stream.id}`, {
            resolution: { width: 640, height: 832 },
            framerate: 30,
            rotation: "cw",
            createLog: true,
            createDecoderLog: config.debug.value,
          })
        );
      } else if (stream.type === "video" && !config.video.value) {
        log.warn(
          "Not in video mode. Skipping video stream source for: " +
            `${stream.name}-${stream.id}`
        );
      }
    } else {
      log.debug("Ignoring disabled stream: " + `${stream.name}-${stream.id}`);
    }
  });
};

// creates the main electron window
const createMain = () => {
  const width = 1200,
    height = 800;

  // get the correct icon
  const iconSuffix =
    process.platform === "win32"
      ? ".ico"
      : process.platform === "darwin"
        ? ".icns"
        : ".png";

  windows.main = new BrowserWindow({
    width: width * config.scale.value,
    height: height * config.scale.value,
    resizable: false,
    frame: false,
    autoHideMenuBar: true,
    icon: path.join(iconPath, "logo" + iconSuffix),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  windows.main.loadFile(path.join(__dirname, "src/index.html"));

  // only auto-open the devtools in debug mode
  if (config.debug.value)
    windows.main.webContents.openDevTools({ mode: "detach" });

  // handle switching between fullscreen mode
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

  // send video controls whether or not we need them so the inputs load properly
  windows.main.webContents.once("dom-ready", () => {
    windows.main.webContents.send("video-controls", videoControls);
  });

  // only create serial streams if reading debug data from local files
  if (!config.dataDebug.value) {
    loadStreams();
  }

  log.debug("Main window created");
};

// creates the video electron window
const createVideo = () => {
  const width = 1280,
    height = 720;

  // get the correct icon
  const iconSuffix =
    process.platform === "win32"
      ? ".ico"
      : process.platform === "darwin"
        ? ".icns"
        : ".png";

  windows.video = new BrowserWindow({
    width: width * config.scale.value,
    height: height * config.scale.value,
    frame: false,
    autoHideMenuBar: true,
    icon: path.join(iconPath, "logo" + iconSuffix),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  windows.video.loadFile(path.join(__dirname, "src/video/video.html"));

  // only auto-open the devtools in debug mode
  if (config.debug.value)
    windows.video.webContents.openDevTools({ mode: "detach" });

  // reset when the window is closed
  windows.video.once("close", () => {
    windows.video.webContents.send("close"); // unused
  });

  windows.video.once("closed", () => {
    windows.video = null;
  });

  // handle fullscreen changes
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

  log.debug("Live stream window created");
};

// tells electron to ignore OS level display scaling
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=8192");
app.commandLine.appendSwitch("high-dpi-support", 1);
app.commandLine.appendSwitch("force-device-scale-factor", 1);

// when electron has initialized, create the appropriate window
app.whenReady().then(() => {
  createMain();
  if (config.video.value) createVideo();

  // open a new window if there are none when the app is opened and is still running (MacOS)
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMain();
      if (config.video.value) createVideo();
    }
  });
});

// quit the app if all windows are closed on MacOS
app.on("window-all-closed", () => {
  app.quit();
});

// app control
ipcMain.on("close", (event, name) => {
  windows[name].close();
});

ipcMain.on("minimize", (event, name) => {
  windows[name].minimize();
});

ipcMain.on("fullscreen", (event, name, isFullscreen) => {
  windows[name].setFullScreen(isFullscreen);
});

ipcMain.on("reload", (event, win, keepSettings) => {
  log.debug("Reloading window");
  // handle reloading main window
  if (win === "main") {
    try {
      // load command list and stateflags
      cmdList = JSON.parse(fs.readFileSync("./commands.json"));

      APRSCmd.createCommandList(cmdList);

      stateflags = JSON.parse(fs.readFileSync("./stateflags.json"));

      APRSTelem.createStateflagList(stateflags);

      log.debug("Reloaded commands and stateflags");
    } catch (err) {
      log.warn("Failed to load commands or stateflags file: " + err.message);
    }
    // reload all sources and sinks
    loadStreams();
    // close serial connection, but keep pipes and the driver running
    serial.reset();
    //if mainWin exists reload it
    if (windows.main) {
      windows.main.webContents.reloadIgnoringCache();
      //if in video mode send the video controls for the control panel
      if (config.video.value && videoControls) {
        windows.main.webContents.once("dom-ready", () => {
          windows.main.webContents.send("video-controls", videoControls);
        });
      }
    }
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

// backend interfaces
ipcMain.on("send-command", (event, command, sinkId) => {
  // TODO: is this necessary?
  for (let i = 0; i < command.length; i++) {
    if (command[i] === "") command[i] = 255;
  }
  if (commandSinks[sinkId]) commandSinks[sinkId].write(command);
  else log.warn("Could not find command sink with id: " + sinkId);
});

ipcMain.on("cache-tile", (event, tile, tilePathNums) => {
  try {
    tilePath = [tilePathNums[0], tilePathNums[1], tilePathNums[2]];
    while (
      cacheMeta.runningSize + tile.byteLength >
      config.cacheMaxSize.value
    ) {
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
      path.join(__dirname, "src", "cachedtiles", "metadata.json"),
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
  serial.reset();
});

ipcMain.on("clear-tile-cache", (event, args) => {
  try {
    // check if the metadata file exists
    if (fs.existsSync(path.join(__dirname, "src", "cachedtiles"))) {
      // reset the metadata and remove the metadata file
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
  log.debug("Updating video controls: " + JSON.stringify(controls));

  //make sure we actually got a controls object
  if (controls) {
    videoControls = controls;

    //if so, pass it on to videoWin, if it exists
    if (windows.video)
      windows.video.webContents.send("video-controls", videoControls);
    else log.warn("Failed setting video controls, video window missing.");
  } else log.warn("Failed setting video controls, new controls missing.");
});

ipcMain.on("export-stream-config", (event, args) => {
  let exportedCommandConfig = [];
  cmdList.forEach((cmd) => {
    exportedCommandConfig.push({
      num: cmd.num,
      encoding: cmd.encoding,
      functionName: cmd.functionName,
    });
  });

  try {
    fs.writeFileSync(
      path.join(dataPath, "commands.json"),
      JSON.stringify(exportedCommandConfig)
    );
  } catch (err) {
    log.err("Failed to export commands: " + err.message);
  }

  config.streams.forEach((stream) => {
    if (stream.type === "APRSTelem") {
      let exportedStateflagsConfig = [];
      stateflags.forEach((flag) => {
        if (
          stream.settings &&
          stream.settings.stateflags &&
          stream.settings.stateflags.includes(flag.name)
        ) {
          exportedStateflagsConfig.push({
            width: flag.width,
            functionName: flag.functionName,
          });
        }
      });

      try {
        fs.writeFileSync(
          path.join(dataPath, stream.name + "-stateflags.json"),
          JSON.stringify(exportedStateflagsConfig)
        );
      } catch (err) {
        log.err(
          "Failed to export stateflags for " + stream.name + ": " + err.message
        );
      }
    }
  });

  log.info("Successfully exported commands and stateflags");
});

// getters
ipcMain.handle("get-ports", (event, args) => {
  if (!config.dataDebug.value && !config.driverDebug.value)
    return serial.getAvailablePorts();
  else if (config.driverDebug.value) return [{ path: "Begin driver debug" }];
  else if (config.dataDebug.value) return [];
});

ipcMain.handle("get-port-status", (event, args) => {
  return serial.isConnected();
});

ipcMain.handle("get-settings", (event, args) => {
  return config;
});

ipcMain.handle("reset-settings", (event) => {
  try {
    // don't want to actually reset settings on the backend, just send them to the settings page
    // which will send the final state of the settings page back to us later
    return JSON.parse(fs.readFileSync("./default-config.json"));
  } catch (err) {
    log.err("Failed getting default settings: " + err.message);
  }
});

ipcMain.handle("get-streams", (event, args) => {
  return config.streams;
});

ipcMain.handle("get-command-list", (event, args) => {
  return cmdList;
});

ipcMain.handle("get-stateflag-list", (event, args) => {
  return stateflags;
});

ipcMain.handle("get-video", (event, args) => {
  let videoData = [];
  videoSources.forEach((stream) => {
    if (stream.hasFrame()) {
      let streamName = stream.name.split("-");
      streamName.pop();
      // must use readFrame() to get rid of old frame
      videoData.push({ name: streamName.join("-"), data: stream.readFrame() });
    } else videoData.push(null); // TODO: this seems a bit odd
  });
  return videoData;
});

// setters
ipcMain.handle("set-port", (event, portConfig) => {
  return new Promise((res, rej) => {
    // convert user interface friendly string to more generic string for the serial driver
    if (config.driverDebug.value && portConfig.path === "Begin driver debug")
      portConfig.path = "begin debug";

    if (!config.dataDebug.value) {
      // try to connect to the given port, log any errors
      serial
        .connect(portConfig.path, config.baudRate.value)
        .then((result) => {
          // TODO: maybe put this in a better spot
          // needs to be after the pipes are created
          videoSources.forEach((source) => {
            source.startOutput();
          });
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
    } else {
      log.warn(
        "Attempted serial connection in data debug mode. Switch out of data debug mode to use the serial driver"
      );
      res(0);
    }
  });
});

ipcMain.on("update-settings", (event, settings) => {
  // make sure we were actually given a settings object
  if (settings) {
    config = settings;
    try {
      // write the new settings to the file
      fs.writeFileSync("./config.json", JSON.stringify(config, null, "\t"));
      log.debug("Successfully updated settings");
    } catch (err) {
      log.err('Failed to update settings: "' + err.message + '"');
    }
  }
});

ipcMain.on("set-streams", (event, streams) => {
  if (streams) {
    config.streams = streams;
    if (!config.dataDebug.value) {
      // need to reload streams and reset serial to get everything updated
      loadStreams();
      serial.reset();
    }
    try {
      // write the new settings to the file
      fs.writeFileSync("./config.json", JSON.stringify(config, null, "\t"));
      log.debug("Successfully updated stream settings");
    } catch (err) {
      log.err('Failed to update stream settings: "' + err.message + '"');
    }
  }
});

ipcMain.on("set-command-list", (event, list) => {
  if (list) {
    cmdList = list;
    APRSCmd.createCommandList(cmdList);
    try {
      // write the new settings to the file
      fs.writeFileSync("./commands.json", JSON.stringify(list, null, "\t"));
      log.debug("Successfully updated commands settings");
    } catch (err) {
      log.err('Failed to update commands settings: "' + err.message + '"');
    }
  }
});

ipcMain.on("set-stateflag-list", (event, list) => {
  if (list) {
    stateflags = list;

    APRSTelem.createStateflagList(stateflags);
    try {
      // write the new settings to the file
      fs.writeFileSync("./stateflags.json", JSON.stringify(list, null, "\t"));
      log.debug("Successfully updated stateflags settings");
    } catch (err) {
      log.err('Failed to update stateflags settings: "' + err.message + '"');
    }
  }
});

// serial state handling
serial.on("error", (message) => {
  log.err("Serial driver error: " + message);
});

serial.on("close", (path) => {
  log.info("Serial disconnected");
  if (!closed && windows.main)
    windows.main.webContents.send("serial-close", path);
});

serial.on("exit", () => {
  log.info("Serial driver exited");
});

// testing
if (config.dataDebug.value) {
  // start after 1 second to give everything time to load
  setTimeout(() => {
    // set up telemetry sources
    // test to see whether the first telemetry stream data file exists
    if (fs.existsSync("./test-0.csv")) {
      try {
        const ts1D = new FileTelemSource("./test-0.csv", {
          datarate: 1,
          parser: (data) => {
            // make sure we got a valid line
            if (!closed && windows.main) {
              let aprsMsg = APRSTelem.fromCSV(data);

              // The rawStateflags should be correctly populated from CSV data
              // but the Stage is not being properly recognized because stateflagsFormat is empty
              // Either use the existing raw state flags directly (already in our patched getStateflag method)
              // or explicitly set the stateflags format

              // We're using an empty stateflags array but our improved getStateflag will handle this
              aprsMsg.stateflagsFormat = []; // Clear existing format if any

              windows.main.webContents.send("data", aprsMsg);
              if (windows.video)
                windows.video.webContents.send("data", aprsMsg);
            }
          },
        });
        telemSources.push(ts1D);
      } catch (err) {
        log.err('Failed to read test-0.csv: "' + err.message + '"');
      }
    } else {
      log.warn("Could not find test-0.csv");
    }

    // test to see whether the second telemetry stream data file exists
    if (fs.existsSync("./test-1.csv")) {
      try {
        const ts2D = new FileTelemSource("./test-1.csv", {
          datarate: 1,
          parser: (data) => {
            // make sure we got a valid line
            if (!closed && windows.main) {
              let aprsMsg = APRSTelem.fromCSV(data);
              windows.main.webContents.send("data", aprsMsg);
              if (windows.video)
                windows.video.webContents.send("data", aprsMsg);
            }
          },
        });
        telemSources.push(ts2D);
      } catch (err) {
        log.err('Failed to read test-1.csv: "' + err.message + '"');
      }
    } else {
      log.warn("Could not find test-1.csv");
    }

    // test to see whether the third telemetry stream data file exists
    if (fs.existsSync("./test-2.csv")) {
      try {
        const ts3D = new FileTelemSource("./test-2.csv", {
          datarate: 1,
          parser: (data) => {
            // make sure we got a valid line
            if (!closed && windows.main) {
              let aprsMsg = APRSTelem.fromCSV(data);
              windows.main.webContents.send("data", aprsMsg);
              if (windows.video)
                windows.video.webContents.send("data", aprsMsg);
            }
          },
        });
        telemSources.push(ts3D);
      } catch (err) {
        log.err('Failed to read test-2.csv: "' + err.message + '"');
      }
    } else {
      log.warn("Could not find test-2.csv");
    }

    // test to see whether the telmetry stream metrics data file exists
    if (fs.existsSync("./metrics.csv")) {
      try {
        const metrics = new FileTelemSource("./metrics.csv", {
          datarate: 1,
          parser: (data) => {
            // make sure we got a valid line
            if (!closed && windows.main) {
              let m = Metrics.fromCSV(data);
              windows.main.webContents.send("metrics", m);
              if (windows.video) windows.video.webContents.send("metrics", m);
            }
          },
        });
        telemSources.push(metrics);
      } catch (err) {
        log.err('Failed to read metrics.csv: "' + err.message + '"');
      }
    } else {
      log.warn("Could not find metrics.csv");
    }

    // create the command sink
    commandSinks.push(
      new FileCommandSink(path.join(logPath, "commands.txt"), {
        asString: true,
      })
    );

    if (config.video.value) {
      // test to see if first video exists
      if (fs.existsSync("./video0.av1")) {
        // create new video source from file
        let vs1 = new FileVideoSource(
          "./video0.av1",
          {
            resolution: { width: 640, height: 832 },
            framerate: 30,
            rotation: "cw",
            createDecoderLog: config.debug.value,
          },
          "video0-0"
        );
        videoSources.push(vs1);
        // start the video
        vs1.startOutput();
      }

      // test to see if second video exists
      if (fs.existsSync("./video1.av1")) {
        // create new video source from file
        let vs2 = new FileVideoSource(
          "./video1.av1",
          {
            resolution: { width: 640, height: 832 },
            framerate: 30,
            rotation: "cw",
            createDecoderLog: config.debug.value,
          },
          "video1-0"
        );
        videoSources.push(vs2);
        // start the video
        vs2.startOutput();
      }
    }
  }, 1000);
}
