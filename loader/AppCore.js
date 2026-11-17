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

    // ipcMain.on("get-interfaces", (event, args) => {
    //   log.debug("Got get-interfaces");
    //   this.windows.forEach(async (val, key) => {
    //     if (val.webContents == event.sender) {
    //       log.debug("Got get-interfaces from " + key);
    //       if (this.windowInterfaceCallbacks.get(key)) {
    //         // load each interface
    //         await this.waitForResponses(
    //           event.sender,
    //           this.windowInterfaceCallbacks.get(key),
    //         );
    //         log.debug("here");
    //         return 0;
    //       } else {
    //         log.warn("No interface registered for window: " + key);
    //         return -1;
    //       }
    //     }
    //   });
    //   return -2;
    // });

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
        log.err("Failed to load default config: " + err.message);
      }
    }

    // load command list
    try {
      this.streams = JSON.parse(
        fs.readFileSync(path.join(AppCore.root, "streams.json")),
      );

      log.debug("Streams loaded");
    } catch (err) {
      log.warn(
        "Failed to load streams file, previously configured streams will not be available: " +
          err.message,
      );
      this.streams = [];
    }

    // clear tile cache if disabled
    if (!this.appConfig.tileCache.value) {
      // if the cache is disabled, remove cached tiles on startup
      try {
        // check if the metadata file exists
        if (fs.existsSync(path.join(AppCore.root, "src", "cachedtiles"))) {
          // reset the metadata and remove the metadata file
          this.cacheMeta = {
            tiles: {},
            fileList: [],
            runningSize: 0,
          };
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

    // load command list
    try {
      this.cmdList = JSON.parse(
        fs.readFileSync(path.join(AppCore.root, "commands.json")),
      );

      APRSCmd.createCommandList(this.cmdList);

      log.debug("Commands loaded");
    } catch (err) {
      log.warn(
        "Failed to load commands file, some features will not be available: " +
          err.message,
      );
      this.cmdList = [];
    }

    // load stateflags
    try {
      this.stateflags = JSON.parse(
        fs.readFileSync(path.join(AppCore.root, "stateflags.json")),
      );

      APRSTelem.createStateflagList(this.stateflags);

      log.debug("Stateflags loaded");
    } catch (err) {
      log.warn(
        "Failed to load stateflags file, some features will not be available: " +
          err.message,
      );
      this.stateflags = [];
    }

    // load control list
    try {
      this.ctrlList = JSON.parse(
        fs.readFileSync(path.join(AppCore.root, "control.json")),
      );

      GSControl.createControlList(this.ctrlList);

      log.debug("Control commands loaded");
    } catch (err) {
      log.warn(
        "Failed to load control command file, some features will not be available: " +
          err.message,
      );
      this.ctrlList = [];
    }

    // load tile cache metadata
    try {
      this.cacheMeta = JSON.parse(
        fs.readFileSync(
          path.join(AppCore.root, "src", "cachedtiles", "metadata.json"),
        ),
      );
      log.debug("Cache metadata loaded");
    } catch (err) {
      // load defaults if no metadata file
      this.cacheMeta = {
        tiles: {},
        fileList: [],
        runningSize: 0,
      };
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
            JSON.stringify(cacheMeta, null, "\t"),
          );
          log.info("Metadata file successfully created");
        }
      } catch (err) {
        log.err('Failed to create metadata file: "' + err.message + '"');
      }
    }
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

  getStreamTypes() {
    const types = [];
    this.streamCallbacks.forEach((val, name) => {
      if (!name.match("debug-.+")) types.push(name);
    });
    return types;
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

  getStreams() {
    return this.streams;
  }

  addWindows(windows) {
    if (windows instanceof Map) {
      windows.forEach((val, key) => {
        this.windows.set(key, val);
      });
    } else {
      log.err("Expected Map, but did not get one. Windows not added!");
    }
  }

  registerWindowReloadCallback(name, cb) {
    if (!this.windowReloadCallbacks.has(name))
      this.windowReloadCallbacks.set(name, cb);
    else log.err(`Callback to load window ${name} already registered!`);
  }

  loadWindows(mainSession, pluginsSession) {
    this.mainSession = mainSession;
    this.pluginsSession = pluginsSession;

    this.main.createWindows(mainSession);

    this.addWindows(this.main.getWindows());

    this.plugins.createWindows(pluginsSession);

    this.addWindows(this.plugins.getWindows());
  }

  reloadWindow(name) {
    if (this.windowReloadCallbacks.has(name))
      this.windowReloadCallbacks.get(name)();
    else log.debug(`No load callbck registered for ${name}`);
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

  initRendererEvent(name, windowName) {
    // this.registerWindowInterfaceCallback(windowName, () => {
    //   if (this.windows.get(windowName))
    //     this.windows.get(windowName).webContents.send("renderer-event", name);
    // });
  }

  initMainEvent(eventName, cb) {
    ipcMain.on(eventName, (event, ...args) => {
      cb(event, ...args);
    });

    // this.registerWindowInterfaceCallback(windowName, () => {
    //   if (this.windows.get(windowName)) {
    //     log.debug("Loading event " + name);
    //     this.windows.get(windowName).webContents.send("renderer-send", name);
    //   }
    // });
  }

  initMainHandler(eventName, cb) {
    ipcMain.handle(eventName, (event, ...args) => {
      return cb(event, ...args);
    });

    // this.registerWindowInterfaceCallback(windowName, () => {
    //   if (this.windows.get(windowName))
    //     this.windows.get(windowName).webContents.send("renderer-invoke", name);
    // });
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

  // registerWindowInterfaceCallback(name, cb) {
  //   if (!this.windowInterfaceCallbacks.has(name)) {
  //     this.windowInterfaceCallbacks.set(name, [cb]);
  //   } else {
  //     this.windowInterfaceCallbacks.get(name).push(cb);
  //     log.debug(this.windowInterfaceCallbacks.get(name).length);
  //   }
  // }

  setClosed() {
    this.closed = true;
  }

  appClosed() {
    return this.closed;
  }
}

module.exports = AppCore;
