const path = require("path");
const fs = require("fs");
const { log } = require("../debug");

class PluginSocket {
  constructor(pluginPath) {
    this.pluginPath = pluginPath;
    this.name = pluginPath.split(path.sep).pop();
    this.version = null;
    this.defaultConfig = null;

    this.enabled = null;
    this.plugin = null;
    this.config = null;

    this.loaded = false;

    this.loadPluginInfo();
  }

  loadPluginInfo() {
    // read plugin info from plugin-specific JSON
    const pluginData = JSON.parse(
      fs.readFileSync(path.join(this.pluginPath, "plugin.json")),
    );

    // check for required fields
    if (
      !pluginData ||
      !pluginData.name ||
      !pluginData.version ||
      !pluginData.defaultConfig
    ) {
      throw new Error("Invalid plugin.json for plugin at " + this.pluginPath);
    }

    if (this.name != pluginData.name) {
      throw new Error(
        'Plugin name "' + this.name + '" does not match plugin folder!',
      );
    }

    this.version = pluginData.version;
    this.defaultConfig = pluginData.defaultConfig;
  }

  loadConfig(pluginConfig) {
    // check that plugin configs is actually an array
    if (pluginConfig) {
      // check for required fields
      if (
        !pluginConfig.hasOwnProperty("name") ||
        !pluginConfig.hasOwnProperty("enabled") ||
        !pluginConfig.hasOwnProperty("config")
      ) {
        if (!this.config) {
          log.warn(
            "Invalid plugin config and no existing fallback, using defaults",
          );
          // set default config
          this.enabled = false;
          this.config = this.defaultConfig;
        } else {
          throw new Error("Invalid new plugin config");
        }
      } else {
        this.enabled = pluginConfig.enabled;
        this.config = pluginConfig.config;
      }

      // update the plugin itself with the new config
      if (this.plugin) this.plugin.setPluginConfig(this.config);
    } else {
      throw new Error("Invalid plugin configs list!");
    }
  }

  loadConfigFromList(pluginConfigs) {
    // check that plugin configs is actually an array
    if (pluginConfigs && pluginConfigs.length) {
      // find the correct config
      let configFound = false;
      const configsLen = pluginConfigs.length;
      for (let i = 0; i < configsLen; i++) {
        if (pluginConfigs[i].name == this.name) {
          // load the config
          this.loadConfig(pluginConfigs[i]);
          // leave the loop
          configFound = true;
          break;
        }
      }

      // check if there was not a config in the list, but a config for this socket was already initialized
      if (!configFound && this.config)
        log.warn(
          'Plugin config list did not contain a config for the plugin "' +
            this.name +
            '"',
        );
    } else {
      throw new Error("Invalid plugin configs list!");
    }
  }

  saveConfig() {}

  initializePlugin() {
    const pluginEntryPoint = path.join(this.pluginPath, "plugin.js");
    if (fs.existsSync(pluginEntryPoint)) {
      this.plugin = require(pluginEntryPoint);
    } else {
      log.err('Unable to locate plugin "' + sock.name + '"');
    }
  }
}

module.exports = PluginSocket;
