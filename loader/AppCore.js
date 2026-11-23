const fs = require("fs");
const path = require("path");

const { ipcMain } = require("electron");

const { log } = require("../debug");

const { SerialControlSink, FileControlSink } = require("../io/text-io");
const APRSTelem = require("../coders/APRSTelem");
const Metrics = require("../coders/Metrics");
const APRSCmd = require("../coders/APRSCmd");
const GSControl = require("../coders/GSControl");
const { EventEmitter } = require("stream");

class AppCore extends EventEmitter {
  static root = path.join(__dirname, "..");

  constructor(version, mainLoader, pluginLoader) {
    super();
    this.version = version;
    this.main = mainLoader;
    this.plugins = pluginLoader;

    this.closed = false;

    // configs
    this.appConfig = null;
    this.streams = null;
    this.cmdList = null;
    this.stateflags = null;
    this.ctrlList = null;
    this.cacheMeta = null;

    this.mainSession = null;
    this.pluginsSession = null;

    // handlers
    this.windows = new Map(); // holds all windows
    this.windowReloadCallbacks = new Map();
    this.windowInterfaceCallbacks = new Map();
    this.serialControl = null;
    this.streamCallbacks = new Map();
  }

  init() {
    this.loadConfig();

    this.main.init(this.appConfig);
    this.plugins.init(this.appConfig);

    this.setupWindowInterfaces(this.main.initWindowInterfaces());
    this.setupWindowInterfaces(this.plugins.initWindowInterfaces());

    this.main.initStreamTypes().forEach((callback, name) => {
      this.registerStreamCallback(name, callback);
    });

    this.plugins.initStreamTypes().forEach((callback, name) => {
      this.registerStreamCallback(name, callback);
    });
  }

  loadConfig() {
    /*
    See default-config.json for default settings
    */
    try {
      // load config
      this.appConfig = JSON.parse(
        fs.readFileSync(path.join(AppCore.root, "config.json")),
      );
      // temporary check for property values being defined
      // will eventually just check config version
      if (
        this.appConfig.debugScale !== undefined ||
        this.appConfig.noGUI !== undefined ||
        this.appConfig.version !== this.version
      ) {
        log.warn(
          "Older config version (likely v1.5) detected, save your settings to remove this warning",
        );
        throw new Error("old config version"); // throw an error to get the default config to load
      }
      // setup logger
      log.useDebug = this.appConfig.debug.value;
      if (this.appConfig.dataDebug.value && this.appConfig.driverDebug.value)
        log.warn(
          'Configuration warning: "Debug Data Input" and "Serial Driver Debug" have both been turned on. These settings can create conflicting streams of data so it is recommended to disable one of them.',
        );
      log.debug("Config loaded");
    } catch (err) {
      // load defaults if no config file
      log.warn("Failed to load config file, using defaults: " + err.message);
      try {
        this.appConfig = JSON.parse(
          fs.readFileSync(path.join(AppCore.root, "default-config.json")),
        );
        if (this.appConfig.version !== this.version) {
          log.warn(
            "Developer warning: default config version does not match app version! You can probably safely ignore this error. Updating default config version.",
          );
          // update config file version if app version has changed
          this.appConfig.version = this.version;
          fs.writeFileSync(
            path.join(AppCore.root, "default-config.json"),
            JSON.stringify(this.appConfig, null, "\t"),
          );
        }
        // create new config file
        try {
          if (!fs.existsSync(path.join(AppCore.root, "config.json"))) {
            fs.writeFileSync(
              path.join(AppCore.root, "config.json"),
              JSON.stringify(this.appConfig, null, "\t"),
            );
            log.info("Config file successfully created");
          }
        } catch (err) {
          log.err("Failed to create config file: " + err.message);
        }
      } catch (err) {
        log.err("FATAL: Failed to load default config: " + err.message);
        // new Promise((resolve) => {
        //   // Force flush stdout
        //   if (process.stdout.writableLength) {
        //     process.stdout.write("", () => {
        //       // Then flush stderr if needed
        //       if (process.stderr.writableLength) {
        //         process.stderr.write("", resolve);
        //       } else {
        //         resolve();
        //       }
        //     });
        //   } else {
        //     resolve();
        //   }
        // }).then(() => {
        //   process.exit(1);
        // });
      }
    }

    // load command list
    try {
      const streams = JSON.parse(
        fs.readFileSync(path.join(AppCore.root, "streams.json")),
      );

      if (this.setStreams(streams)) log.debug("Streams loaded");
      else throw new Error("Invalid stream config");
    } catch (err) {
      log.warn(
        "Failed to load streams file, previously configured streams will not be available: " +
          err.message,
      );
      this.setStreams([]);
    }

    // load command list
    try {
      const cmdList = JSON.parse(
        fs.readFileSync(path.join(AppCore.root, "commands.json")),
      );

      if (this.setCommandList(cmdList)) log.debug("Commands loaded");
      else throw new Error("Invalid commands config");
    } catch (err) {
      log.warn(
        "Failed to load commands file, some features will not be available: " +
          err.message,
      );
      this.setCommandList([]);
    }

    // load stateflags
    try {
      const stateflags = JSON.parse(
        fs.readFileSync(path.join(AppCore.root, "stateflags.json")),
      );

      if (this.setStateflags(stateflags)) log.debug("Stateflags loaded");
      else throw new Error("Invalid stageflags config");
    } catch (err) {
      log.warn(
        "Failed to load stateflags file, some features will not be available: " +
          err.message,
      );
      this.setStateflags([]);
    }

    // load control list
    try {
      const ctrlList = JSON.parse(
        fs.readFileSync(path.join(AppCore.root, "control.json")),
      );

      if (this.setControlList(ctrlList)) log.debug("Control commands loaded");
      else throw new Error("Invalid control commands config");
    } catch (err) {
      log.warn(
        "Failed to load control command file, some features will not be available: " +
          err.message,
      );
      this.setControlList([]);
    }

    // clear tile cache if disabled
    if (!this.appConfig.tileCache.value) {
      // if the cache is disabled, remove cached tiles on startup
      try {
        // check if the metadata file exists
        if (fs.existsSync(path.join(AppCore.root, "src", "cachedtiles"))) {
          // reset the metadata and remove the metadata file
          this.setTileCacheMetadata({
            tiles: {},
            fileList: [],
            runningSize: 0,
          });
          fs.rmSync(path.join(AppCore.root, "src", "cachedtiles"), {
            recursive: true,
            force: true,
          });
          log.debug("Tile cache successfully cleared");
        }
      } catch (err) {
        log.err('Error clearing tile cache: "' + err.message + '"');
      }
    }

    // load tile cache metadata
    try {
      const cacheMeta = JSON.parse(
        fs.readFileSync(
          path.join(AppCore.root, "src", "cachedtiles", "metadata.json"),
        ),
      );

      if (this.setTileCacheMetadata(cacheMeta))
        log.debug("Cache metadata loaded");
      else throw new Error("Invalid tile cache metadata");
    } catch (err) {
      // load defaults if no metadata file
      this.setTileCacheMetadata({
        tiles: {},
        fileList: [],
        runningSize: 0,
      });
      log.warn(
        'Failed to load cache metadata file, using defaults: "' +
          err.message +
          '"',
      );
      // create new metadata file
      try {
        // make the folder if it doesn't exist
        if (!fs.existsSync(path.join(AppCore.root, "src", "cachedtiles")))
          fs.mkdirSync(path.join(AppCore.root, "src", "cachedtiles"));
        // write the file if it doesn't exist
        if (
          !fs.existsSync(
            path.join(AppCore.root, "src", "cachedtiles", "metadata.json"),
          )
        ) {
          fs.writeFileSync(
            path.join(AppCore.root, "src", "cachedtiles", "metadata.json"),
            JSON.stringify(this.cacheMeta, null, "\t"),
          );
          log.info("Metadata file successfully created");
        }
      } catch (err) {
        log.err('Failed to create metadata file: "' + err.message + '"');
      }
    }
  }

  loadWindows(mainSession, pluginsSession) {
    this.mainSession = mainSession;
    this.pluginsSession = pluginsSession;

    // expose plugin API's in main session

    // create main window
    this.main.createWindows(mainSession);

    this.addWindows(this.main.getWindows());

    // create plugin windows
    this.plugins.createWindows(pluginsSession);

    this.addWindows(this.plugins.getWindows());
  }

  loadStreams() {
    this.main.clearStreams();

    this.plugins.clearStreams();

    if (!this.appConfig.dataDebug.value) {
      // reset everything
      // this.emit("reload-streams");

      // create serial control sink to talk to serial device
      this.serialControl = new SerialControlSink("device-status", 1, {
        createLog: true,
      });

      // load streams from config
      this.streams.forEach((stream) => {
        if (stream.enabled) {
          // try to find the callback for this stream
          if (this.streamCallbacks.has(stream.type)) {
            this.streamCallbacks.get(stream.type)(stream);
          } else {
            log.err(
              `Failed to initalize stream: ${stream.name}-${stream.id}, no valid handler found for type ${stream.type}`,
            );
          }
        } else {
          log.debug(`Ignoring disabled stream: ${stream.name}-${stream.id}`);
        }
      });
    } else {
      // debug streams
    }
  }

  loadDebugStreams(streamsList) {
    this.serialControl = new FileControlSink(
      path.join(logPath, "control.txt"),
      1,
      {
        asString: true,
      },
    );

    streamsList.forEach((stream) => {
      // try to find the callback for this stream
      if (this.streamCallbacks.has(stream.type)) {
        this.streamCallbacks.get(stream.type)(stream);
      } else {
        log.err(
          `Failed to initalize stream: ${stream.name}-${stream.id}, no valid handler found for type ${stream.type}`,
        );
      }
    });
  }

  listenForData() {
    this.main.on("data", (type, data) => {
      this.windows.forEach((val, key) => {
        if (val) val.webContents.send(type, data);
      });
    });

    // this.plugins.on("data", (type, data) => {
    //   this.windows.forEach((val, key) => {
    //     if (val) val.webContents.send(type, data);
    //   });
    // });
  }

  getAppConfig() {
    return this.appConfig;
  }

  getWindows() {
    return this.windows;
  }

  getWindow(name) {
    return this.windows.get(name);
  }

  getMainWindow() {
    // Note: not guaranteed to exist
    return this.windows.get("main");
  }

  getStreams() {
    return this.streams;
  }

  getStreamTypes() {
    const types = [];
    this.streamCallbacks.forEach((val, name) => {
      if (!name.match("debug-.+")) types.push(name);
    });
    return types;
  }

  getCommandList() {
    return this.cmdList;
  }

  getStateflags() {
    return this.stateflags;
  }

  getControlList() {
    return this.ctrlList;
  }

  getTileCacheMetadata() {
    return this.cacheMeta;
  }

  setAppConfig(appConfig) {
    if (appConfig instanceof Object) {
      if (
        appConfig.debugScale !== undefined ||
        appConfig.noGUI !== undefined ||
        appConfig.version !== this.version
      ) {
        log.err("Tried to set invalid config");
      } else {
        this.appConfig = appConfig;
        // setup logger
        log.useDebug = this.appConfig.debug.value;
        return true;
      }
    }
    return false;
  }

  addWindows(windows) {
    if (windows instanceof Map) {
      windows.forEach((val, key) => {
        this.windows.set(key, val);
      });
      return true;
    } else {
      log.err("Expected Map, but did not get one. Windows not added!");
    }
    return false;
  }

  setStreams(streams) {
    if (streams instanceof Array) this.streams = streams;
    return streams instanceof Array;
  }

  setCommandList(cmdList) {
    if (cmdList instanceof Array) {
      this.cmdList = cmdList;
      APRSCmd.createCommandList(this.cmdList);
      return true;
    }
    return false;
  }

  setStateflags(stateflags) {
    if (stateflags instanceof Array) {
      this.stateflags = stateflags;
      APRSTelem.createStateflagList(this.stateflags);
      return true;
    }
    return false;
  }

  setControlList(ctrlList) {
    if (ctrlList instanceof Array) {
      this.ctrlList = ctrlList;
      GSControl.createControlList(this.ctrlList);
      return true;
    }
    return false;
  }

  setTileCacheMetadata(cacheMeta) {
    if (cacheMeta instanceof Object) {
      this.cacheMeta = cacheMeta;
      return true;
    }
    return false;
  }

  registerWindowReloadCallback(name, cb) {
    if (!this.windowReloadCallbacks.has(name))
      this.windowReloadCallbacks.set(name, cb);
    else log.err(`Callback to load window ${name} already registered!`);
  }

  reloadWindow(name) {
    if (this.windowReloadCallbacks.has(name))
      this.windowReloadCallbacks.get(name)();
    else log.debug(`No load callbck registered for ${name}`);
  }

  initMainEvent(eventName, cb) {
    ipcMain.on(eventName, (event, ...args) => {
      cb(event, ...args);
    });
  }

  initMainHandler(eventName, cb) {
    ipcMain.handle(eventName, (event, ...args) => {
      return cb(event, ...args);
    });
  }

  registerStreamCallback(name, createCB) {
    if (!this.streamCallbacks.has(name))
      this.streamCallbacks.set(name, createCB);
    else log.err(`Callback to create stream ${name} already registered!`);
  }

  setupWindowInterfaces(interfaces) {
    if (interfaces.mainEvent) {
      interfaces.mainEvent.forEach((callback, name) => {
        this.initMainEvent(name, callback);
      });
    }
    if (interfaces.mainHandle) {
      interfaces.mainHandle.forEach((callback, name) => {
        this.initMainHandler(name, callback);
      });
    }
  }

  setClosed() {
    this.closed = true;
  }

  appClosed() {
    return this.closed;
  }
}

module.exports = AppCore;
