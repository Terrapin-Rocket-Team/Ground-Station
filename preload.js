const { ipcRenderer, contextBridge } = require("electron");
// custom event emitter class so event listeners can be added to the electron api in the renderer
// all methods must be attributes due to how electron handles objects
class EventEmitter {
  constructor() {
    // holds the events registered to the emitter and their listeners
    this._events = {};

    // adds a listener to an event
    this.on = (name, listener) => {
      if (!this._events[name]) {
        this._events[name] = [];
      }

      this._events[name].push(listener);
    };

    // removes a listener for an event
    this.removeListener = (name, listenerToRemove) => {
      if (this._events[name]) {
        const filterListeners = (listener) => listener !== listenerToRemove;

        this._events[name] = this._events[name].filter(filterListeners);
      }
    };

    // calls all the listeners for an event
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

    // generic IPC listeners/function creation for backend
    ipcRenderer.on("renderer-event", (event, name) => {
      ipcRenderer.on(name, (event, ...args) => {
        this.emit(name, ...args);
      });
      ipcRenderer.send("interface-done");
    });

    ipcRenderer.on("renderer-send", (event, name) => {
      this[name] = (...args) => ipcRenderer.send(name, ...args);
      ipcRenderer.send("interface-done");
    });

    ipcRenderer.on("renderer-invoke", (event, name) => {
      this[name] = (...args) => ipcRenderer.invoke(name, ...args);
      ipcRenderer.send("interface-done");
    });

    // Electron IPC listeners to pass events to the renderer
    ipcRenderer.on("data", (event, data) => {
      this.emit("data", data);
    });

    ipcRenderer.on("metrics", (event, data) => {
      this.emit("metrics", data);
    });

    ipcRenderer.on("serial-close", (event, portPath) => {
      this.emit("serial-close", portPath);
    });

    ipcRenderer.on("fullscreen-change", (event, change) => {
      this.emit("fullscreen-change", change);
    });

    // TODO: move to dynamic
    ipcRenderer.on("video-controls", (event, controls) => {
      this.emit("video-controls", controls);
    });

    // TODO: move to dynamic
    ipcRenderer.on("frame-ready", (event, frame) => {
      this.emit("frame-ready", frame);
    });

    ipcRenderer.on("close", (event, data) => {
      this.emit("close");
    }); // unused

    // app control
    this.close = (win) => ipcRenderer.send("close", win);
    this.minimize = (win) => ipcRenderer.send("minimize", win);
    this.fullscreen = (win, isFullscreen) =>
      ipcRenderer.send("fullscreen", win, isFullscreen);
    this.devTools = () => ipcRenderer.send("dev-tools");
    this.reload = (win, keepSettings) =>
      ipcRenderer.send("reload", win, keepSettings);

    // backend interfaces
    // TODO: move to dynamic
    // this.sendCommand = (command, sinkId) =>
    //   ipcRenderer.send("send-command", command, sinkId);
    // TODO: move to dynamic
    this.cacheTile = (tile, path) => ipcRenderer.send("cache-tile", tile, path);
    // TODO: move to dynamic
    this.getCachedTiles = () => ipcRenderer.invoke("get-tiles");
    this.closePort = () => ipcRenderer.send("close-port");
    // TODO: move to dynamic
    this.clearTileCache = () => ipcRenderer.send("clear-tile-cache");
    // TODO: move to dynamic
    this.updateVideoControls = (controls) =>
      ipcRenderer.send("video-controls", controls);
    // TODO: move to dynamic
    this.exportStreamConfig = () => ipcRenderer.send("export-stream-config");

    // getters
    this.getPorts = () => ipcRenderer.invoke("get-ports");
    this.getPortStatus = () => ipcRenderer.invoke("get-port-status");
    this.getSettings = () => ipcRenderer.invoke("get-settings");
    this.getPluginSettings = (pluginName) =>
      ipcRenderer.invoke("get-plugin-settings", pluginName);
    // TODO: move to dynamic
    this.resetSettings = () => ipcRenderer.invoke("reset-settings");
    // TODO: move to dynamic
    this.resetPluginSettings = () =>
      ipcRenderer.invoke("reset-plugin-settings");
    this.getStreams = () => ipcRenderer.invoke("get-streams");
    this.getCommandList = () => ipcRenderer.invoke("get-command-list");
    this.getStateflagList = () => ipcRenderer.invoke("get-stateflag-list");
    this.getControlsList = () => ipcRenderer.invoke("get-controls-list");
    // TODO: move to dynamic
    this.getVideo = () => ipcRenderer.invoke("get-video");

    // setters
    this.setPort = (portConfig) => ipcRenderer.invoke("set-port", portConfig);
    // TODO: move to dynamic
    this.setSettings = (config) => ipcRenderer.send("update-settings", config);
    // TODO: move to dynamic
    this.setPluginSettings = (configs) =>
      ipcRenderer.send("set-plugin-settings", configs);
    // TODO: move to dynamic
    this.setStreams = (streams) => ipcRenderer.send("set-streams", streams);
    // TODO: move to dynamic
    this.setCommandList = (list) => ipcRenderer.send("set-command-list", list);
    // TODO: move to dynamic
    this.setStateflagList = (list) =>
      ipcRenderer.send("set-stateflag-list", list);
  }
}

const api = new API();

// ipcRenderer.send("get-interfaces");

contextBridge.exposeInMainWorld("api", api);

// .then((resp) => {
//   console.log(resp);
//   // expose the api to the renderer
// });
