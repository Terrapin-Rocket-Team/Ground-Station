const { BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { log } = require("../../debug");
const Plugin = require("../Plugin");
const { FileVideoSource, SerialVideoSource } = require("./io/video-io");

class VideoPlugin extends Plugin {
  static iconPath = path.join(__dirname, Plugin.rootOffset, "icons");

  constructor() {
    super();
    this.window = null;
    this.windowName = "video";
    this.videoSources = [];

    this.videoControls = {
      layout: "two-video",
      video0: "none-0",
      video1: "none-1",
    };
  }

  init(loader, appConfig, pluginConfig) {
    this.setPluginConfig(pluginConfig);
    this.setAppConfig(appConfig);

    loader.on("app-ready", () => {
      loader.setLoaded(this);
    });

    loader.on("main-window-loaded", (mainWin) => {
      // send video controls whether or not we need them so the inputs load properly
      mainWin.webContents.once("dom-ready", () => {
        mainWin.webContents.send(
          "video-controls",
          this.getEffectiveVideoControls(),
        );
      });
    });

    loader.on("config", (config) => {
      this.setAppConfig(config);
    });

    // TODO: this doesn't exactly work
    loader.on("plugin-config", (configs) => {
      this.setPluginConfig(configs[this.name]);
    });

    loader.on("serial-connected", (portConfig) => {
      // TODO: maybe put this in a better spot
      // needs to be after the pipes are created
      this.videoSources.forEach((source) => {
        source.startOutput();
      });
    });

    if (this.pluginConfig && !this.pluginConfig.webcamTest) {
      this.pluginConfig.webcamTest = {
        name: "Test Webcam Input",
        description:
          "Temporarily stream the default webcam into video Input 0 for testing.",
        value: false,
        type: "toggle",
      };
    }
    if (this.pluginConfig && !this.pluginConfig.webcam480p) {
      this.pluginConfig.webcam480p = {
        name: "Test Webcam 480p",
        description:
          "Request 480p from the temporary webcam input and scale it to fit the video display.",
        value: false,
        type: "toggle",
      };
    }
  }

  setAppConfig(appConfig) {
    this.appConfig = appConfig;
  }

  setPluginConfig(pluginConfig) {
    // if this.pluginConfig is not null, there is a previous config
    if (this.pluginConfig) {
      // check if config changed
      const webcamTestChanged =
        this.pluginConfig?.webcamTest?.value !== config.webcamTest?.value ||
        this.pluginConfig?.webcam480p?.value !== config.webcam480p?.value;

      if (webcamTestChanged) {
        const effectiveControls = getEffectiveVideoControls();
        // TODO: make this work
        // if (windows.main)
        //   windows.main.webContents.send("video-controls", effectiveControls);
        if (this.window)
          this.window.webContents.send("video-controls", effectiveControls);
      }
    }

    this.pluginConfig = pluginConfig;
  }

  initWindowInterfaces() {
    const windowMainEventInterfaces = new Map();
    const windowMainHandleInterfaces = new Map();

    windowMainEventInterfaces.set("video-controls", (event, controls) => {
      log.debug("Updating video controls: " + JSON.stringify(controls));

      //make sure we actually got a controls object
      if (controls) {
        this.videoControls = controls;

        //if so, pass it on to videoWin, if it exists
        if (this.window)
          this.window.webContents.send(
            "video-controls",
            this.getEffectiveVideoControls(),
          );
        else log.warn("Failed setting video controls, video window missing.");
      } else log.warn("Failed setting video controls, new controls missing.");
    });

    windowMainHandleInterfaces.set("get-video", (event, args) => {
      let videoData = [];
      this.videoSources.forEach((stream) => {
        if (stream.hasFrame()) {
          let streamName = stream.name;
          // must use readFrame() to get rid of old frame
          videoData.push({ name: streamName, data: stream.readFrame() });
        } else videoData.push(null); // TODO: this seems a bit odd
      });
      return videoData;
    });

    return {
      mainEvent: windowMainEventInterfaces,
      mainHandle: windowMainHandleInterfaces,
    };
  }

  initStreamTypes() {
    const streamTypes = new Map();

    streamTypes.set("Video", this.createVideoStream.bind(this));
    streamTypes.set("debug-video", this.createDebugVideoStream.bind(this));

    return streamTypes;
  }

  // creates the video electron window
  createWindows(session) {
    if (this.pluginConfig.video.value) {
      const width = 1280,
        height = 720;

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
        frame: false,
        autoHideMenuBar: true,
        icon: path.join(VideoPlugin.iconPath, "logo" + iconSuffix),
        webPreferences: {
          session: session,
          preload: path.join(__dirname, "preload.js"),
        },
      });

      // local to plugin, so don't need rootOffset here
      this.window.loadFile(path.join(__dirname, "src/video/video.html"));

      // only auto-open the devtools in debug mode
      if (this.appConfig.debug.value)
        this.window.webContents.openDevTools({ mode: "detach" });

      // reset when the window is closed
      this.window.once("close", () => {
        this.window.webContents.send("close"); // unused
      });

      this.window.once("closed", () => {
        this.window = null;
        loader.unlinkWindow(this.windowName); // TODO: fix
      });

      // handle fullscreen changes
      this.window.on("enter-full-screen", () => {
        log.debug("Enter video fullscreen");
        this.window.webContents.send("fullscreen-change", {
          win: "video",
          isFullscreen: true,
        });
      });

      this.window.on("leave-full-screen", () => {
        log.debug("Leave video fullscreen");
        this.window.webContents.send("fullscreen-change", {
          win: "video",
          isFullscreen: false,
        });
      });

      log.debug("Live stream window created");
    }
  }

  getWindows() {
    const m = new Map();
    m.set(this.windowName, this.window);
    return m;
  }

  clearStreams() {
    this.videoSources = [];
  }

  getEffectiveVideoControls() {
    const controls = { ...this.videoControls };
    if (this.appConfig?.webcamTest?.value) controls.video0 = "camera:default";
    controls.webcam480p = !!this.appConfig?.webcam480p?.value;
    return controls;
  }

  createVideoStream(stream) {
    // have to return a function or the "this" keyword gets replaced by the object used by PluginLoader
    if (this.pluginConfig.video.value) {
      this.videoSources.push(
        new SerialVideoSource(stream.name, stream.id, {
          resolution: { width: 640, height: 832 },
          framerate: 30,
          rotation: "cw",
          createLog: true,
          createDecoderLog: this.appConfig.debug.value,
        }),
      );
    } else {
      log.warn(
        "Not in video mode. Skipping video stream source for: " +
          `${stream.name}-${stream.id}`,
      );
    }
  }

  createDebugVideoStream() {
    if (this.pluginConfig.video.value) {
      // test to see if first video exists
      if (fs.existsSync("./video0.av1")) {
        // create new video source from file
        let vs1 = new FileVideoSource(
          "video0.av1",
          0,
          {
            resolution: { width: 640, height: 832 },
            framerate: 30,
            rotation: "cw",
            createDecoderLog: this.appConfig.debug.value,
          },
          "video0",
        );
        this.videoSources.push(vs1);
        // start the video
        vs1.startOutput();
      } else {
        log.warn("Could not find video0.av1");
      }

      if (fs.existsSync("./video1.av1")) {
        // create new video source from file
        let vs2 = new FileVideoSource(
          "video1.av1",
          1,
          {
            resolution: { width: 640, height: 832 },
            framerate: 30,
            rotation: "cw",
            createDecoderLog: obj.appConfig.debug.value,
          },
          "video1",
        );
        obj.videoSources.push(vs2);
        // start the video
        vs2.startOutput();
      } else {
        log.warn("Could not find video1.av1");
      }
    }
  }
}

const p = new VideoPlugin();

module.exports = p;
