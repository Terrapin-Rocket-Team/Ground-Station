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

    ipcRenderer.on("data", (event, data) => {
      this.emit("data", data);
    });

    ipcRenderer.on("radio-close", (event, data) => {
      this.emit("radio-close");
    });

    //app control
    this.close = () => ipcRenderer.send("close");
    this.minimize = () => ipcRenderer.send("minimize");
    this.reload = () => ipcRenderer.send("reload");
    this.devTools = () => ipcRenderer.send("dev-tools");
    this.openDebug = () => ipcRenderer.send("open-debug");

    //getters
    this.getPorts = () => ipcRenderer.invoke("get-ports");

    //setters
    this.setPort = (port) => ipcRenderer.invoke("set-port", port);
  }
}

const api = new API();

//expose the api to the renderer
contextBridge.exposeInMainWorld("api", api);
