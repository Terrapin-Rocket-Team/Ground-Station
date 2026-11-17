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

    // TODO: move to dynamic
    ipcRenderer.on("video-controls", (event, controls) => {
      this.emit("video-controls", controls);
    });

    // TODO: move to dynamic
    ipcRenderer.on("frame-ready", (event, frame) => {
      this.emit("frame-ready", frame);
    });

    // TODO: move to dynamic
    this.updateVideoControls = (controls) =>
      ipcRenderer.send("video-controls", controls); // TODO: this actually goes in main

    // TODO: move to dynamic
    this.getVideo = () => ipcRenderer.invoke("get-video");
  }
}

const api = new API();

contextBridge.exposeInMainWorld("videoApi", api);
