const path = require("path");
const fs = require("fs");
const { log } = require("../debug");
const PluginSocket = require("./PluginSocket");
const { EventEmitter } = require("stream");

class PluginLoader extends EventEmitter {
  static defaultPluginPath = path.join(__dirname, "..", "plugins");
  constructor(pluginDir = PluginLoader.defaultPluginPath) {
    super();
    // global settings
    this.pluginPath = pluginDir;
    this.sockets = [];
    this.loaded = false;

    // arrays of assets registered by plugins
    this.windows = {};
    this.streamTypes = {};

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

  init(config) {
    let initialized = 0;
    let disabled = 0;
    try {
      this.sockets.forEach((sock) => {
        // initialize plugin
        try {
          if (sock.enabled) {
            log.debug('Initializing plugin "' + sock.name + '"');
            sock.initializePlugin();
            sock.plugin.init(this, config, sock.config);
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

  registerWindow(name) {
    this.windows[name] = null;
  }
  registerStreamType(name) {
    this.streamTypes[name] = null;
  }
  registerPage(name) {}

  linkWindow(name, window) {
    this.windows[name] = window;
  }
  linkStreamType(name, callback, debugCallback) {
    this.streamTypes[name] = { create: callback, createDebug: debugCallback };
  }

  unlinkWindow(name) {
    this.windows[name] = null;
  }
  unlinkStreamType(name) {
    this.streamTypes[name] = null;
  }

  loadStream(stream) {
    // call the relevant callback for the stream type, if it is registered
    if (this.streamTypes[stream.type]) {
      if (this.streamTypes[stream.type].create) {
        this.streamTypes[stream.type].create(stream);
        return true;
      } else {
        log.err(
          `No stream creation function registered for type "${stream.type}"`,
        );
      }
    }
    return false;
  }

  loadDebugStreams() {
    Object.keys(this.streamTypes).forEach((streamType) => {
      if (this.streamTypes[streamType].createDebug)
        this.streamTypes[streamType].createDebug();
      else
        log.warn(
          `Stream type "${streamType}" does not have a debug configuration! No stream(s) will be created.`,
        );
    });
  }
}

const pLoader = new PluginLoader();

module.exports = { pLoader, PluginLoader };
