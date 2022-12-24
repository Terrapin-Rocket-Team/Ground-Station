const { ipcRenderer, contextBridge } = require("electron");

class EventEmitter {
  constructor() {
    this._events = {};

    this.on = (name, listener) => {
      if (!this._events[name]) {
        this._events[name] = [];
      }

      this._events[name].push(listener);
    };

    this.removeListener = (name, listenerToRemove) => {
      if (this._events[name]) {
        const filterListeners = (listener) => listener !== listenerToRemove;

        this._events[name] = this._events[name].filter(filterListeners);
      }
    };

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

    ipcRenderer.on("print", (event, message, level) => {
      this.emit("print", { message, level });
    });

    ipcRenderer.on("previous-logs", (event, data) => {
      this.emit("previous-logs", data);
    });

    ipcRenderer.on("data", (event, data) => {
      this.emit("data", data);
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

contextBridge.exposeInMainWorld("api", api);
