const { log } = require("../../debug");

class VideoPlugin {
  constructor() {}

  init() {
    log.debug("Hello from plugin");
  }
}

const p = new VideoPlugin();

module.exports = p;
