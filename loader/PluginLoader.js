const path = require("path");
const fs = require("fs");
const { log } = require("../debug");
const PluginSocket = require("./PluginSocket");
const { EventEmitter } = require("stream");

class PluginLoader extends EventEmitter {
  static defaultPluginPath = path.join(__dirname, "..", "plugins");
  constructor(iconPath) {
    super();
    // global settings
    this.pluginPath = PluginLoader.defaultPluginPath;
    this.sockets = [];
    this.loaded = false;

    // arrays of assets registered by plugins
    this.windows = new Map();
  }

  init(appConfig) {
    // get plugin config
    this.loadConfig();

    // load plugins
    let initialized = 0;
    let disabled = 0;
    try {
      this.sockets.forEach((sock) => {
        // initialize plugin
        try {
          if (sock.enabled) {
            log.debug('Initializing plugin "' + sock.name + '"');
            sock.initializePlugin();
            sock.plugin.init(this, appConfig, sock.config);
            initialized++;
          } else {
            disabled++;
            log.debug('Skipping disabled plugin "' + sock.name + '"');
          }
        } catch (error) {
          log.err("Error initializing plugin: " + error.message);
        }
      });

      log.info("Initialized " + initialized + " plugins");
      if (initialized + disabled < this.sockets.length)
        log.warn(
          "Some plugins failed to load! Their functionality will be unavailable.",
        );
    } catch (e) {
      log.err("Failed loading plugins " + e.message);
    }
  }

  loadConfig() {
    // read all plugins
    try {
      const pluginConfigs = JSON.parse(
        fs.readFileSync(path.join(__dirname, "plugins.json")),
      );

      // TODO: handle loading new plugins, removing config from uninstalled plugins
      fs.readdirSync(this.pluginPath).forEach((f) => {
        // log.debug('Looking for plugin "' + f + '"');
        try {
          if (fs.lstatSync(path.join(this.pluginPath, f)).isDirectory()) {
            try {
              const sock = new PluginSocket(path.join(this.pluginPath, f));
              // add to sockets array
              this.sockets.push(sock);
              // load plugin config
              sock.loadConfigFromList(pluginConfigs);
              log.debug('Loaded plugin: "' + f + " v" + sock.version + '"');
            } catch (error) {
              log.err(
                'Error reading metadata for plugin "' + f + '": ' + error.stack,
              );
            }
          }
        } catch (error) {
          log.err('Error looking for plugin "' + f + '": ' + error.message);
        }
      });
    } catch (error) {
      log.err("Error reading plugin directory: " + error.message);
    }

    log.info("Loaded " + this.sockets.length + " plugins");
  }

  initWindowInterfaces() {
    const windowMainEventInterfaces = new Map();
    const windowMainHandleInterfaces = new Map();
    // loop through each socket
    this.sockets.forEach((sock) => {
      // if it has stream types
      if (sock.plugin.initWindowInterfaces) {
        // add the stream type unless it already exists
        const interfaces = sock.plugin.initWindowInterfaces();
        interfaces.mainEvent.forEach((val, name) => {
          if (!windowMainEventInterfaces.has(name))
            windowMainEventInterfaces.set(name, val);
        });

        interfaces.mainHandle.forEach((val, name) => {
          if (!windowMainHandleInterfaces.has(name))
            windowMainHandleInterfaces.set(name, val);
        });
      }
    });

    return {
      mainEvent: windowMainEventInterfaces,
      mainHandle: windowMainHandleInterfaces,
    };
  }

  initStreamTypes() {
    const m = new Map();
    // loop through each socket
    this.sockets.forEach((sock) => {
      // if it has stream types
      if (sock.plugin.initStreamTypes) {
        // add the stream type unless it already exists
        sock.plugin.initStreamTypes().forEach((val, name) => {
          if (!m.has(name)) m.set(name, val);
        });
      }
    });

    return m;
  }

  createWindows(session) {
    this.sockets.forEach((sock) => {
      if (sock.plugin.createWindows) {
        sock.plugin.createWindows(session);
        this.addWindows(sock.plugin.getWindows());
      }
    });
  }

  getWindows() {
    return this.windows;
  }

  addWindows(windows) {
    if (windows instanceof Map) {
      windows.forEach((val, key) => {
        this.windows.set(key, val);
      });
    } else {
      log.err("Expected Map, but did not get one. Plugin windows not added!");
    }
  }

  clearStreams() {
    this.sockets.forEach((sock) => {
      if (sock.plugin.clearStreams) sock.plugin.clearStreams();
    });
  }

  getPluginConfigs() {
    const configs = [];
    this.sockets.forEach((sock) => {
      configs.push(sock.config);
    });

    return configs;
  }

  getPluginConfig(name) {
    this.sockets.forEach((sock) => {
      if (sock.name == name) return sock.config;
    });
  }

  getDefaultPluginConfigs() {
    const configs = [];
    this.sockets.forEach((sock) => {
      configs.push(sock.defaultConfig);
    });

    return configs;
  }

  setPluginConfig(config) {
    // ensure valid config
    if (config && config.name) {
      // find correct socket
      const sockLen = this.sockets.length;
      for (let i = 0; i < sockLen; i++) {
        if (this.sockets[i].name == config.name) {
          this.sockets[i].loadConfig(config);
          break;
        }
      }
    } else {
      log.err("New plugin config missing plugin name.");
    }
  }

  setPluginConfigs(configs) {
    // check for valid config list
    if (configs && configs.length) {
      // load new config in each plugin
      this.sockets.forEach((sock) => {
        sock.loadConfigFromList(configs);
      });
    } else {
      log.err("New plugin config missing plugin name.");
    }
  }

  setLoaded(plugin) {
    const len = this.sockets.length;
    for (let i = 0; i < len; i++) {
      if (this.sockets[i].plugin == plugin) {
        log.debug('Successfully loaded plugin "' + this.sockets[i].name + '"');
        this.sockets[i].loaded = true;
        this.checkAllLoaded();
        break;
      }
    }
  }

  checkAllLoaded() {
    const len = this.sockets.length;
    for (let i = 0; i < len; i++) {
      if (!this.sockets[i].loaded) {
        return false;
      }
    }

    this.emit("plugins-loaded", this.windows);
    return true;
  }
}

const pLoader = new PluginLoader();

module.exports = { pLoader, PluginLoader };
