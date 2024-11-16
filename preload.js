const { ipcRenderer, contextBridge } = require("electron");

//custom event emitter class so event listeners can be added to the electron api in the renderer
//all methods must be attributes due to how electron handles objects
class EventEmitter {
  constructor() {
    //holds the events registered to the emitter and their listeners
    this._events = {};

    //adds a listener to an event
    this.on = (name, listener) => {
      if (!this._events[name]) {
        this._events[name] = [];
      }

      this._events[name].push(listener);
    };

    //removes a listener for an event
    this.removeListener = (name, listenerToRemove) => {
      if (this._events[name]) {
        const filterListeners = (listener) => listener !== listenerToRemove;

        this._events[name] = this._events[name].filter(filterListeners);
      }
    };

    //calls all the listeners for an event
    this.emit = (name, data) => {
      if (this._events[name]) {
        const fireCallbacks = (callback) => {
          callback(data);
        };
        this._events[name].forEach(fireCallbacks);
      }
    };
  }
}

class API extends EventEmitter {
  constructor() {
    super();

    //Electron IPC listeners to pass events to the renderer
    ipcRenderer.on("print", (event, message, level) => {
      this.emit("print", { message, level });
    });

    ipcRenderer.on("previous-logs", (event, data) => {
      this.emit("previous-logs", data);
    });

    ipcRenderer.on("data", (event, data, name) => {
      this.emit("data", data, name);
    });

    ipcRenderer.on("serial-close", (event, portPath) => {
      this.emit("serial-close", portPath);
    });

    ipcRenderer.on("fullscreen-change", (event, change) => {
      this.emit("fullscreen-change", change);
    });

    ipcRenderer.on("video-controls", (event, controls) => {
      this.emit("video-controls", controls);
    });

    ipcRenderer.on("frame-ready", (event, frame) => {
      this.emit("frame-ready", frame);
    });

    ipcRenderer.on("close", (event, data) => {
      this.emit("close");
    }); // unused

    //app control
    this.close = (win) => ipcRenderer.send("close", win);
    this.minimize = (win) => ipcRenderer.send("minimize", win);
    this.fullscreen = (win, isFullscreen) =>
      ipcRenderer.send("fullscreen", win, isFullscreen);
    this.reload = (win, keepSettings) =>
      ipcRenderer.send("reload", win, keepSettings);
    this.devTools = () => ipcRenderer.send("dev-tools");
    this.openDebug = () => ipcRenderer.send("open-debug");
    this.openGUI = () => ipcRenderer.send("open-gui");
    this.openCommand = () => ipcRenderer.send("radio-command");
    this.sendCommand = (command) =>
      ipcRenderer.send("radio-command-sent", command);
    this.cacheTile = (tile, path) => ipcRenderer.send("cache-tile", tile, path);
    this.getCachedTiles = () => ipcRenderer.invoke("get-tiles");
    this.closePort = () => ipcRenderer.send("close-port");
    this.clearTileCache = () => ipcRenderer.send("clear-tile-cache");
    this.updateVideoControls = (controls) =>
      ipcRenderer.send("video-controls", controls);

    //getters
    this.getPorts = () => ipcRenderer.invoke("get-ports");
    this.getPortStatus = () => ipcRenderer.invoke("get-port-status");
    this.getSettings = () => ipcRenderer.invoke("get-settings");
    this.getVideo = () => ipcRenderer.invoke("get-video");

    //setters
    this.setPort = (portConfig) => ipcRenderer.invoke("set-port", portConfig);
    this.setSettings = (config) => ipcRenderer.send("update-settings", config);
  }
}

const api = new API();

//expose the api to the renderer
contextBridge.exposeInMainWorld("api", api);
