const path = require("path");

class Plugin {
  static rootOffset = path.join("..", "..");
  constructor() {
    this.appConfig = null;
    this.pluginConfig = null;
  }

  init(loader, appConfig, pluginConfig) {}

  setPluginConfig(pluginConfig) {}
}

module.exports = Plugin;
