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

    // backend interfaces
    this.sendCommand = (command, sinkId) =>
      ipcRenderer.send("send-command", command, sinkId);
    // // TODO: move to dynamic
    // this.cacheTile = (tile, path) => ipcRenderer.send("cache-tile", tile, path);
    // // TODO: move to dynamic
    // this.getCachedTiles = () => ipcRenderer.invoke("get-tiles");
    // this.closePort = () => ipcRenderer.send("close-port");
    // // TODO: move to dynamic
    // this.clearTileCache = () => ipcRenderer.send("clear-tile-cache");
    // // TODO: move to dynamic
    // this.updateVideoControls = (controls) =>
    //   ipcRenderer.send("video-controls", controls);
    this.exportStreamConfig = () => ipcRenderer.send("export-stream-config");

    // // getters
    // this.getPorts = () => ipcRenderer.invoke("get-ports");
    // this.getPortStatus = () => ipcRenderer.invoke("get-port-status");
    // this.getSettings = () => ipcRenderer.invoke("get-settings");
    // this.getPluginSettings = (pluginName) =>
    //   ipcRenderer.invoke("get-plugin-settings", pluginName);
    this.resetSettings = () => ipcRenderer.invoke("reset-settings");
    this.resetPluginSettings = () =>
      ipcRenderer.invoke("reset-plugin-settings");
    // this.getStreams = () => ipcRenderer.invoke("get-streams");
    // this.getCommandList = () => ipcRenderer.invoke("get-command-list");
    // this.getStateflagList = () => ipcRenderer.invoke("get-stateflag-list");
    // this.getControlsList = () => ipcRenderer.invoke("get-controls-list");
    // // TODO: move to dynamic
    // this.getVideo = () => ipcRenderer.invoke("get-video");

    // // setters
    // this.setPort = (portConfig) => ipcRenderer.invoke("set-port", portConfig);
    this.setSettings = (config) => ipcRenderer.send("update-settings", config);
    this.setPluginSettings = (configs) =>
      ipcRenderer.send("set-plugin-settings", configs);
    this.setStreams = (streams) => ipcRenderer.send("set-streams", streams);
    this.setCommandList = (list) => ipcRenderer.send("set-command-list", list);
    this.setStateflagList = (list) =>
      ipcRenderer.send("set-stateflag-list", list);
  }
}

const api = new API();

contextBridge.exposeInMainWorld("mainApi", api);
