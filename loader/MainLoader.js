const fs = require("fs");
const path = require("path");

const { BrowserWindow } = require("electron");

const { log } = require("../debug");

const {
  FileTelemSource,
  SerialTelemSource,
  SerialCommandSink,
  FileCommandSink,
  SerialControlSink,
  FileControlSink,
} = require("../io/text-io");

const APRSTelem = require("../coders/APRSTelem");
const Metrics = require("../coders/Metrics");
const APRSCmd = require("../coders/APRSCmd");
const GSControl = require("../coders/GSControl");
const { EventEmitter } = require("stream");

class MainLoader extends EventEmitter {
  static root = path.join(__dirname, "..");

  constructor(iconPath) {
    super();
    this.iconPath = iconPath;

    this.appConfig = null;
    this.core = null;

    this.window = null;
    this.telemSources = [];
    this.commandSinks = [];
  }

  init(appCore) {
    this.core = appCore;
    this.appConfig = this.core.getAppConfig();

    // load config files
    this.loadConfig();

    // define pages???
  }

  loadConfig() {}

  initWindowInterfaces() {
    // const windowRendererInterfaces = new Map();
    const windowMainEventInterfaces = new Map();
    // const windowMainHandleInterfaces = new Map();

    windowMainEventInterfaces.set("send-command", (event, command, sinkId) => {
      if (this.commandSinks[sinkId]) this.commandSinks[sinkId].write(command);
      else log.warn("Could not find command sink with id: " + sinkId);
    });

    return {
      rendererEvent: undefined,
      mainEvent: windowMainEventInterfaces,
      mainHandle: undefined,
    };
  }

  initStreamTypes() {
    const streamTypes = new Map();

    streamTypes.set("APRSTelem", this.createTelemStream.bind(this));
    streamTypes.set("APRSCmd", this.createCmdStream.bind(this));
    streamTypes.set("Metrics", this.createMetricsStream.bind(this));
    streamTypes.set("debug-telem", this.createDebugTelemStream.bind(this));
    streamTypes.set("debug-cmd", this.createDebugCmdStream.bind(this));
    streamTypes.set("debug-metrics", this.createDebugMetricsStream.bind(this));

    return streamTypes;
  }

  createWindows() {
    const width = 1200,
      height = 800;

    // get the correct icon
    const iconSuffix =
      process.platform === "win32"
        ? ".ico"
        : process.platform === "darwin"
          ? ".icns"
          : ".png";

    this.window = new BrowserWindow({
      width: width * this.appConfig.scale.value,
      height: height * this.appConfig.scale.value,
      resizable: false,
      frame: false,
      autoHideMenuBar: true,
      icon: path.join(this.iconPath, "logo" + iconSuffix),
      webPreferences: {
        preload: path.join(MainLoader.root, "main-preload.js"),
      },
    });

    this.window.loadFile(path.join(MainLoader.root, "src", "index.html"));

    // only auto-open the devtools in debug mode
    if (this.appConfig.debug.value)
      this.window.webContents.openDevTools({ mode: "detach" });

    // handle switching between fullscreen mode
    this.window.on("enter-full-screen", () => {
      log.debug("Enter main fullscreen");
      this.window.webContents.send("fullscreen-change", {
        win: "main",
        isFullscreen: true,
      });
    });

    this.window.on("leave-full-screen", () => {
      log.debug("Leave main fullscreen");
      this.window.webContents.send("fullscreen-change", {
        win: "main",
        isFullscreen: false,
      });
    });

    this.window.once("close", () => {
      this.window.webContents.send("close"); // unused
    });

    this.window.once("closed", () => {
      this.window = null;
    });

    // TODO: fix
    // pLoader.emit("main-window-loaded", windows.main);

    // TODO
    // this.window.webContents.on("dom-ready", () => {
    //   log.debug("Sending dynamic events test message");

    //   this.window.webContents.send("test", "Hello World!");

    //   ipcMain.on("test-send", (event, message1, message2) => {
    //     log.debug(message1);
    //     log.debug(message2);
    //   });
    // });

    log.debug("Main window created");
  }

  getWindows() {
    return { main: this.window };
  }

  clearStreams() {
    this.telemSources = [];
    this.commandSinks = [];
  }

  createTelemStream(stream) {
    this.telemSources.push(
      new SerialTelemSource(stream.name, stream.id, {
        parser: (data) => {
          if (!stream.settings || !stream.settings.stateflags) {
            log.err(
              "Stream does not have associated stateflags array in config.json! This was caused by an old version of the Ground Station and should now be fixed. Updating your config file should fix the issue.",
            );
          }
          let telem = new APRSTelem(
            data,
            stream.name,
            stream.settings.stateflags,
          );
          log.info(telem);
          this.emit("data", "data", telem);

          return telem;
        },
        createLog: true,
      }),
    );
  }

  createCmdStream(stream) {
    this.commandSinks.push(
      new SerialCommandSink(stream.name, stream.id, {
        createLog: true,
      }),
    );
  }

  createMetricsStream(stream) {
    this.telemSources.push(
      new SerialTelemSource(stream.name, stream.id, {
        parser: (data) => {
          let telem = new Metrics(data, true);
          log.info(telem);
          this.emit("data", "metrics", telem);

          return telem;
        },
        isMetrics: true,
        createLog: true,
      }),
    );
  }

  createDebugTelemStream(stream) {
    const streamPath = path.join(MainLoader.root, stream.name);
    if (fs.existsSync(streamPath)) {
      try {
        const ts1D = new FileTelemSource(streamPath, stream.id, {
          datarate: 1,
          parser: (data) => {
            // make sure we got a valid line
            // TODO: better closed check
            if (this.core.getMainWindow()) {
              let aprsMsg = APRSTelem.fromCSV(data);

              // The rawStateflags should be correctly populated from CSV data
              // but the Stage is not being properly recognized because stateflagsFormat is empty
              // Either use the existing raw state flags directly (already in our patched getStateflag method)
              // or explicitly set the stateflags format

              // We're using an empty stateflags array but our improved getStateflag will handle this
              aprsMsg.stateflagsFormat = []; // Clear existing format if any

              this.emit("data", "data", aprsMsg);
            }
          },
        });
        this.telemSources.push(ts1D);
      } catch (err) {
        log.err(`Failed to read file: ${stream.name}"` + err.message + '"');
      }
    } else {
      log.warn(`Could not find ${stream.name}`);
    }
  }

  createDebugCmdStream(stream) {
    // create the command sink
    this.commandSinks.push(
      new FileCommandSink(stream.name, stream.id, {
        asString: true,
      }),
    );
  }

  createDebugMetricsStream(stream) {
    // test to see whether the telmetry stream metrics data file exists
    const streamPath = path.join(MainLoader.root, stream.name);
    if (fs.existsSync(streamPath)) {
      try {
        const metrics = new FileTelemSource(streamPath, stream.id, {
          datarate: 1,
          parser: (data) => {
            // make sure we got a valid line
            if (!closed && windows.main) {
              let m = Metrics.fromCSV(data);
              this.emit("data", "metrics", m);
            }
          },
        });
        this.telemSources.push(metrics);
      } catch (err) {
        log.err(`Failed to read ${stream.name}: "` + err.message + '"');
      }
    } else {
      log.warn(`Could not find ${stream.name}`);
    }
  }
}

module.exports = MainLoader;
