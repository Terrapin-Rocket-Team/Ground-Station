const { app, BrowserWindow, ipcMain, session } = require("electron");
if (require("electron-squirrel-startup")) app.quit(); // for app maker
const fs = require("fs");
const path = require("path");
const { log } = require("./debug");
const { serial } = require("./serial/SerialDevice");
// const {
//   FileTelemSource,
//   SerialTelemSource,
//   SerialCommandSink,
//   FileCommandSink,
//   SerialControlSink,
//   FileControlSink,
// } = require("./io/text-io");
const APRSTelem = require("./coders/APRSTelem");
const Metrics = require("./coders/Metrics");
const APRSCmd = require("./coders/APRSCmd");
const GSControl = require("./coders/GSControl");

const AppCore = require("./loader/AppCore");
const MainLoader = require("./loader/MainLoader");
const { PluginLoader } = require("./loader/PluginLoader");

const iconPath = path.join(__dirname, "build", "icons");
const dataPath = "./data";
const logPath = "./log";
// const dataDebugDirs = [__dirname, path.join(__dirname, "docs", "data")]; // TODO: remove

// const getDataDebugFile = (fileName) => {
//   return dataDebugDirs
//     .map((dir) => path.join(dir, fileName))
//     .find((filePath) => fs.existsSync(filePath));
// };

const main = new MainLoader(iconPath),
  plugins = new PluginLoader(iconPath),
  core = new AppCore(app.getVersion(), main, plugins);

core.init();

// need to setup after loading config
serial.setupDriver(core.getAppConfig().driverDebug.value);

try {
  // create output folders for log files and data files
  if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);
  if (!fs.existsSync(logPath)) fs.mkdirSync(logPath);
} catch (err) {
  log.err("Failed to create output folders: " + err.message);
}

// tells electron to ignore OS level display scaling
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=8192");
app.commandLine.appendSwitch("high-dpi-support", 1);
app.commandLine.appendSwitch("force-device-scale-factor", 1);

const loadStreams = () => {
  // only create serial streams if reading debug data from local files
  if (!core.getAppConfig().dataDebug.value) {
    serial.clearStreams();

    core.loadStreams();
  } else {
    const debugStreams = [
      { name: "test-0.csv", id: 2, type: "debug-telem" },
      { name: "test-1.csv", id: 3, type: "debug-telem" },
      { name: "test-2.csv", id: 4, type: "debug-telem" },
      { name: "metrics.csv", id: 1, type: "debug-metrics" },
      { name: "commands.txt", id: 5, type: "debug-cmds" },
    ];
    core.loadDebugStreams(debugStreams);
  }
};

const openWindows = () => {
  // register base preload script
  session.defaultSession.registerPreloadScript({
    type: "frame",
    filePath: path.join(__dirname, "preload.js"),
  });
  // separate main session allows plugins to expose new api's only in the main window
  const mainSession = session.fromPartition("main");
  mainSession.registerPreloadScript({
    type: "frame",
    filePath: path.join(__dirname, "preload.js"),
  });
  core.loadWindows(mainSession, session.defaultSession);

  // make sure messages are not sent to a destroyed window
  core.getMainWindow().once("close", () => {
    core.setClosed();
    serial.close();
    // close all other open windows
    core.getWindows().forEach((val, name) => {
      if (name != "main") val.close();
    });
  });

  plugins.emit("app-ready");
};

// when electron has initialized, create the appropriate window
app.whenReady().then(() => {
  openWindows();

  loadStreams();

  // open a new window if there are none when the app is opened and is still running (MacOS)
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openWindows();
      // loadStreams();
    }

    // if the app is still open we shouldn't need to reload streams
  });

  core.listenForData();
});

// quit the app if all windows are closed on MacOS
app.on("window-all-closed", () => {
  app.quit();
});

// app control
ipcMain.on("close", (event, name) => {
  if (core.getWindow(name)) core.getWindow(name).close();
  else log.warn("Tried to close non-existant window: " + name);
});

ipcMain.on("minimize", (event, name) => {
  if (core.getWindow(name)) core.getWindow(name).minimize();
  else log.warn("Tried to minimize non-existant window: " + name);
});

ipcMain.on("fullscreen", (event, name, isFullscreen) => {
  if (core.getWindow(name)) core.getWindow(name).setFullScreen(isFullscreen);
  else log.warn("Tried to fullscreen non-existant window: " + name);
});

ipcMain.on("dev-tools", (event, args) => {
  // open dev tools for all windows
  core.getWindows().forEach((val, name) => {
    if (val) val.webContents.openDevTools({ mode: "detach" });
  });
});

// TODO
ipcMain.on("reload", (event, win, keepSettings) => {
  log.debug("Reloading window");
  if (core.getWindow(win)) {
    if (win === "main") {
      // close serial connection, but keep pipes and the driver running
      serial.reset();
      // reload app config from relevant files
      core.loadConfig();
      // reload all sources and sinks
      loadStreams();

      // let plugins know main window was reloaded
      plugins.emit("main-window-loaded", core.getMainWindow());
    }

    // reload window itself
    core.getWindow(win).webContents.reloadIgnoringCache();
    // check for handler for this window
    core.reloadWindow(win); // TODO: essentially this function needs to replicate the window load environment with access to all required interfaces for plugins
  }
  // // check that window exists
  // if (windows[win]) {
  //   // handle reloading main window
  //   if (win === "main") {
  //     core.loadConfig();
  //     // reload all sources and sinks
  //     loadStreams();
  //     // close serial connection, but keep pipes and the driver running
  //     serial.reset();
  //     //if mainWin exists reload it
  //     if (core.getMainWindow()) {
  //       core.getMainWindow().webContents.reloadIgnoringCache();

  //       // let plugins know main window was reloaded
  //       plugins.emit("main-window-loaded", core.getMainWindow());
  //     }
  //   } else {
  //     // this must be a plugin window

  //     //PLUGIN TODO: move to plugin
  //     //handle reloading the video window separately
  //     if (win === "video") {
  //       if (windows.video) windows.video.webContents.reloadIgnoringCache();

  //       //if the video settings should not be kept (usually the when videoWin calls the reload), set to defaults
  //       if (!keepSettings) {
  //         videoControls = {
  //           layout: "two-video",
  //           video0: "live-video-0",
  //           video1: "live-video-1",
  //         };
  //         //send defaults to update mainWin
  //         if (videoControls)
  //           windows.main.webContents.send(
  //             "video-controls",
  //             getEffectiveVideoControls(),
  //           );
  //       } else {
  //         //otherwise, mainWin probably force reloaded videoWin, so we want to keep our old settings
  //         windows.video.webContents.once("dom-ready", () => {
  //           windows.video.webContents.send(
  //             "video-controls",
  //             getEffectiveVideoControls(),
  //           );
  //         });
  //       }
  //     }
  //   }
  // }
});

// backend interfaces
// TODO: move to main loader
// ipcMain.on("send-command", (event, command, sinkId) => {
//   if (commandSinks[sinkId]) commandSinks[sinkId].write(command);
//   else log.warn("Could not find command sink with id: " + sinkId);
// });

// TODO: move to main loader
ipcMain.on("cache-tile", (event, tile, tilePathNums) => {
  try {
    tilePath = [tilePathNums[0], tilePathNums[1], tilePathNums[2]];
    while (
      core.cacheMeta.runningSize + tile.byteLength >
      core.getAppConfig().cacheMaxSize.value
    ) {
      // shift off the fileList and delete file and containing folders if necessary
      let oldTile = core.cacheMeta.fileList.shift();
      let oldFolders = oldTile.split(path.sep);
      let fileSize = fs.lstatSync(
        path.join(__dirname, "src", "cachedtiles", oldTile + ".png"),
      ).size;

      //remove the file
      fs.rmSync(path.join(__dirname, "src", "cachedtiles", oldTile + ".png"));

      core.cacheMeta.tiles[oldFolders[0]][oldFolders[1]].splice(
        core.cacheMeta.tiles[oldFolders[0]][oldFolders[1]].indexOf(
          oldFolders[2],
        ),
        1,
      );

      //remove the folder one level above the file if it is empty
      if (
        fs.readdirSync(
          path.join(
            __dirname,
            "src",
            "cachedtiles",
            oldFolders[0],
            oldFolders[1],
          ),
        ).length === 0
      ) {
        fs.rmdirSync(
          path.join(
            __dirname,
            "src",
            "cachedtiles",
            oldFolders[0],
            oldFolders[1],
          ),
        );
        delete core.cacheMeta.tiles[oldFolders[0]][oldFolders[1]];
      }

      //remove the folder two levels above the file if it is empty
      if (
        fs.readdirSync(
          path.join(__dirname, "src", "cachedtiles", oldFolders[0]),
        ).length === 0
      ) {
        fs.rmdirSync(path.join(__dirname, "src", "cachedtiles", oldFolders[0]));
        delete core.cacheMeta.tiles[oldFolders[0]];
      }

      core.cacheMeta.runningSize -= fileSize;
    }

    let folderPath = path.join(
      __dirname,
      "src",
      "cachedtiles",
      tilePath[0],
      tilePath[1],
    );

    //create folders if necessary
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, {
        recursive: true,
      });
    }

    //see what folders/files already exist
    let hasZoom = core.cacheMeta.tiles[tilePath[0]];
    let hasX = hasZoom ? core.cacheMeta.tiles[tilePath[0]][tilePath[1]] : 0;
    let hasY = hasX
      ? core.cacheMeta.tiles[tilePath[0]][tilePath[1]].includes(tilePath[2])
      : 0;

    //add the appropriate amount of stucture to the metadata
    if (!hasZoom) {
      core.cacheMeta.tiles[tilePath[0]] = {
        [tilePath[1]]: [tilePath[2]],
      };
    } else if (!hasX) {
      core.cacheMeta.tiles[tilePath[0]][tilePath[1]] = [tilePath[2]];
    } else if (!hasY) {
      core.cacheMeta.tiles[tilePath[0]][tilePath[1]].push(tilePath[2]);
    }

    if (hasY) {
      //if the file already exists, check if it is a different size
      let fileSize = fs.lstatSync(
        path.join(folderPath, tilePath[2] + ".png"),
      ).size;
      if (fileSize != tile.byteLength) {
        core.cacheMeta.runningSize -= fileSize;
        core.cacheMeta.runningSize += tile.byteLength;
        fs.writeFileSync(
          path.join(folderPath, tilePath[2] + ".png"),
          Buffer.from(tile),
        );
      }
    } else {
      //add the file
      core.cacheMeta.runningSize += tile.byteLength;
      core.cacheMeta.fileList.push(
        path.join(tilePath[0], tilePath[1], tilePath[2]),
      );
      fs.writeFileSync(
        path.join(folderPath, tilePath[2] + ".png"),
        Buffer.from(tile),
      );
    }

    //write metadata
    fs.writeFileSync(
      path.join(__dirname, "src", "cachedtiles", "metadata.json"),
      JSON.stringify(core.cacheMeta, null, "\t"),
    );
  } catch (err) {
    log.err('Error caching tile: "' + err.message + '"');
  }
});

ipcMain.handle("get-tiles", () => {
  return core.cacheMeta.tiles;
});

ipcMain.on("close-port", (event, args) => {
  serial.reset();
});

ipcMain.on("clear-tile-cache", (event, args) => {
  try {
    // check if the metadata file exists
    if (fs.existsSync(path.join(__dirname, "src", "cachedtiles"))) {
      // reset the metadata and remove the metadata file
      core.cacheMeta = {
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

ipcMain.on("export-stream-config", (event, args) => {
  let exportedCommandConfig = [];
  core.cmdList.forEach((cmd) => {
    exportedCommandConfig.push({
      num: cmd.num,
      encoding: cmd.encoding,
      functionName: cmd.functionName,
    });
  });

  try {
    fs.writeFileSync(
      path.join(dataPath, "commands.json"),
      JSON.stringify(exportedCommandConfig),
    );
  } catch (err) {
    log.err("Failed to export commands: " + err.message);
  }

  core.getStreams().forEach((stream) => {
    if (stream.type === "APRSTelem") {
      let exportedStateflagsConfig = [];
      core.stateflags.forEach((flag) => {
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
          JSON.stringify(exportedStateflagsConfig),
        );
      } catch (err) {
        log.err(
          "Failed to export stateflags for " + stream.name + ": " + err.message,
        );
      }
    }
  });

  log.info("Successfully exported commands and stateflags");
});

// getters
ipcMain.handle("get-ports", (event, args) => {
  if (
    !core.getAppConfig().dataDebug.value &&
    !core.getAppConfig().driverDebug.value
  )
    return serial.getAvailablePorts();
  else if (core.getAppConfig().driverDebug.value)
    return [{ path: "Begin driver debug" }];
  else if (core.getAppConfig().dataDebug.value) return [];
});

ipcMain.handle("get-port-status", (event, args) => {
  return new Promise((res, rej) => {
    serial
      .isConnected()
      .then((status) => {
        // translate to frontend
        if (status.path === "begin debug") status.path = "Begin driver debug";
        res(status);
      })
      .catch((err) => {
        rej(err);
      });
  });
});

ipcMain.handle("get-settings", (event, args) => {
  return core.getAppConfig();
});

ipcMain.handle("get-plugin-settings", (event, pluginName) => {
  if (pluginName) {
    return plugins.getPluginConfig(pluginName);
  }
  return plugins.getPluginConfigs();
});

ipcMain.handle("get-stream-types", (event, args) => {
  return core.getStreamTypes();
});

ipcMain.handle("reset-settings", (event) => {
  try {
    // don't want to actually reset settings on the backend, just send them to the settings page
    // which will send the final state of the settings page back to us later
    const defaultSettings = JSON.parse(
      fs.readFileSync("./default-config.json"),
    );
    // send to plugins
    plugins.emit("config", defaultSettings);
    return defaultSettings;
  } catch (err) {
    log.err("Failed getting default settings: " + err.message);
  }
});

ipcMain.handle("reset-plugin-settings", (event, args) => {
  // TODO: synchonize between plugins and main
  // these are stored in mem, so no need for try/catch
  return plugins.getDefaultPluginConfigs();
});

ipcMain.handle("get-streams", (event, args) => {
  return core.getStreams();
});

ipcMain.handle("get-command-list", (event, args) => {
  return core.cmdList;
});

ipcMain.handle("get-stateflag-list", (event, args) => {
  return core.stateflags;
});

ipcMain.handle("get-controls-list", (event, args) => {
  return core.ctrlList;
});

// setters
ipcMain.handle("set-port", (event, portConfig) => {
  return new Promise((res, rej) => {
    // convert user interface friendly string to more generic string for the serial driver
    if (
      core.getAppConfig().driverDebug.value &&
      portConfig.path === "Begin driver debug"
    )
      portConfig.path = "begin debug";

    if (!core.getAppConfig().dataDebug.value) {
      // try to connect to the given port, log any errors
      serial
        .connect(portConfig.path, core.getAppConfig().baudRate.value)
        .then((result) => {
          plugins.emit("serial-connected", portConfig);
          log.info("Successfully connected to port " + portConfig.path);
          res(1);
        })
        .catch((err) => {
          log.err(
            "Failed to connect to port " +
              portConfig.path +
              ': "' +
              err.message +
              '"',
          );
          res(0);
        });
    } else {
      log.warn(
        "Attempted serial connection in data debug mode. Switch out of data debug mode to use the serial driver",
      );
      res(0);
    }
  });
});

ipcMain.on("update-settings", (event, settings) => {
  // make sure we were actually given a settings object
  if (settings) {
    // TODO: make function
    core.appConfig = settings;
    plugins.emit("config", core.getAppConfig());
    try {
      // write the new settings to the file
      fs.writeFileSync(
        "./config.json",
        JSON.stringify(core.getAppConfig(), null, "\t"),
      );
      log.debug("Successfully updated settings");
    } catch (err) {
      log.err('Failed to update settings: "' + err.message + '"');
    }
  } else {
    log.err("New settings missing");
  }
});

ipcMain.on("set-plugin-settings", (event, configs) => {
  if (configs && configs.forEach) {
    try {
      configs.forEach((config) => {
        plugins.setPluginConfig(config);
      });
    } catch (err) {
      log.err('Failed to update plugin settings: "' + err.message + '"');
    }
  } else {
    log.err("New plugin settings missing");
  }
});

ipcMain.on("set-streams", (event, streams) => {
  if (streams) {
    core.streams = streams; // TODO: fix (func)
    if (!core.getAppConfig().dataDebug.value) {
      // need to reload streams and reset serial to get everything updated
      serial.clearStreams();
      serial.reset();
      core.loadStreams();
    }
    try {
      // write the new settings to the file
      // TODO: this should be in core
      fs.writeFileSync(
        "./config.json",
        JSON.stringify(core.getAppConfig(), null, "\t"),
      );
      log.debug("Successfully updated stream settings");
    } catch (err) {
      log.err('Failed to update stream settings: "' + err.message + '"');
    }
  }
});

ipcMain.on("set-command-list", (event, list) => {
  if (list) {
    core.cmdList = list;
    APRSCmd.createCommandList(core.cmdList);
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
    core.stateflags = list;

    APRSTelem.createStateflagList(core.stateflags);
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
  plugins.emit("serial-closed", path);
  // TODO: send to all windows
  if (!core.appClosed() && core.getMainWindow())
    core.getMainWindow().webContents.send("serial-close", path);
});

serial.on("exit", () => {
  log.info("Serial driver exited");
});
